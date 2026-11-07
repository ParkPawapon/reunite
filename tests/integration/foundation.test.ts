import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';
import { databaseConfig } from '../../packages/database/src/config';
import {
  migrate,
  migrationStatus,
  readMigrations,
} from '../../packages/database/src/migrations';
import { withTransaction } from '@campus/database';
import { hashPassword } from '@campus/database/password';
import { createServices } from '@/lib/composition';
import { createHandlers } from '@/lib/http/handlers';
import { hashSessionToken } from '@/lib/security/session';
import { PgReportRepository } from '@/modules/item-reports/infrastructure/pg-report-repository';
import { PgAuthRepository } from '@/modules/auth/infrastructure/pg-auth-repository';

// This suite only creates/drops its own random schema in an explicitly dedicated test DB.
const testUrl = process.env.TEST_DATABASE_URL;
if (
  !testUrl ||
  !/^[a-zA-Z0-9_]+_test$/.test(new URL(testUrl).pathname.slice(1)) ||
  testUrl === process.env.DATABASE_URL
) {
  throw new Error(
    'Set TEST_DATABASE_URL to a separate database whose name ends in _test; integration tests never fall back to DATABASE_URL',
  );
}
const schema = `test_${randomBytes(8).toString('hex')}`;
const config = databaseConfig({
  DATABASE_URL: testUrl,
  DB_POOL_MAX: '5',
  DB_SSL: process.env.DB_SSL,
  DB_SSL_CA: process.env.DB_SSL_CA,
});
const admin = new Pool(config);
const pool = new Pool({ ...config, options: `-c search_path=${schema}` });
const apiHandlers = createHandlers({
  services: () => createServices(pool),
  ping: async () => {
    await pool.query('SELECT 1');
  },
});
const password = randomBytes(18).toString('base64url');
let userId: number;
let otherId: number;
let categoryId: number;
let locationId: number;
let reportId: number;
let claimId: number;
let cookie: string;
let otherCookie: string;
const origin = 'http://localhost:3000';
const request = (
  path: string,
  method = 'GET',
  body?: unknown,
  session?: string,
) =>
  new Request(`${origin}/api/v1/${path}`, {
    method,
    headers: {
      origin,
      'content-type': 'application/json',
      ...(session ? { cookie: session } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const context = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});
const json = async (response: Response) =>
  JSON.parse(await response.text()) as {
    data: Record<string, unknown>;
    error?: { code: string; requestId: string };
  };

beforeAll(async () => {
  process.env.APP_BASE_URL = origin;
  process.env.LOG_LEVEL = 'silent';
  process.env.NODE_ENV = 'test';
  // schema is locally generated hex, never user input.
  await admin.query(`CREATE SCHEMA ${schema}`);
});
afterAll(async () => {
  await pool.end();
  try {
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } finally {
    await admin.end();
  }
});

describe('real PostgreSQL foundation (ordered workflow)', () => {
  it('applies clean migrations once, validates history, and serializes concurrent runners', async () => {
    expect(
      (await migrationStatus(pool)).every((row) => row.status === 'pending'),
    ).toBe(true);
    const results = await Promise.all([migrate(pool), migrate(pool)]);
    expect(results.flat()).toEqual([
      '0001',
      '0002',
      '0003',
      '0004',
      '0005',
      '0006',
    ]);
    expect(await migrate(pool)).toEqual([]);
    expect(
      (await migrationStatus(pool)).every((row) => row.status === 'applied'),
    ).toBe(true);
    const tables = await pool.query<{ table_name: string }>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
      [schema],
    );
    expect(tables.rows.map((row) => row.table_name).sort()).toEqual([
      'auth_login_throttles',
      'auth_sessions',
      'categories',
      'claims',
      'item_reports',
      'locations',
      'notifications',
      'schema_migrations',
      'users',
    ]);
    const files = await readMigrations();
    const first = files[0];
    if (!first) throw new Error('Missing migration');
    await expect(
      migrate(pool, [{ ...first, checksum: 'changed' }, ...files.slice(1)]),
    ).rejects.toThrow('drift');
  });
  it('rolls back failing migration DDL and releases its lock', async () => {
    const files = await readMigrations();
    const sql =
      'CREATE TABLE must_rollback (id integer); SELECT * FROM missing_table_for_migration_test;';
    await expect(
      migrate(pool, [
        ...files,
        {
          version: '0007',
          checksum: createHash('sha256').update(sql).digest('hex'),
          sql,
        },
      ]),
    ).rejects.toThrow('0007');
    expect(
      (
        await pool.query<{ table: string | null }>(
          "SELECT to_regclass('must_rollback')::text AS table",
        )
      ).rows[0]?.table,
    ).toBeNull();
    expect(await migrate(pool)).toEqual([]);
  });
  it('round-trips Unicode users/catalog data with identity PK and unique/not-null constraints', async () => {
    const hash = await hashPassword(password);
    const first = await pool.query<{ user_id: number }>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
      ['ทดสอบ', 'first@example.test', hash],
    );
    const second = await pool.query<{ user_id: number }>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
      ['Other', 'other@example.test', hash],
    );
    userId = first.rows[0]?.user_id ?? 0;
    otherId = second.rows[0]?.user_id ?? 0;
    expect(userId).toBeGreaterThan(0);
    expect(otherId).toBeGreaterThan(userId);
    await expect(
      pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)',
        ['Duplicate', 'first@example.test', hash],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      pool.query('INSERT INTO users (email, password_hash) VALUES ($1,$2)', [
        'missing@example.test',
        hash,
      ]),
    ).rejects.toMatchObject({ code: '23502' });
    await expect(
      pool.query(
        'INSERT INTO users (user_id, name, email, password_hash) VALUES ($1,$2,$3,$4)',
        [99999, 'Explicit', 'explicit@example.test', hash],
      ),
    ).rejects.toMatchObject({ code: '428C9' });
    categoryId =
      (
        await pool.query<{ category_id: number }>(
          'INSERT INTO categories (category_name) VALUES ($1) RETURNING category_id',
          ['Test only หมวดหมู่'],
        )
      ).rows[0]?.category_id ?? 0;
    locationId =
      (
        await pool.query<{ location_id: number }>(
          'INSERT INTO locations (location_name, detail) VALUES ($1, $2) RETURNING location_id',
          ['Test only location', null],
        )
      ).rows[0]?.location_id ?? 0;
    await expect(
      pool.query('INSERT INTO categories (category_name) VALUES ($1)', [
        'Test only หมวดหมู่',
      ]),
    ).rejects.toMatchObject({ code: '23505' });
    const users = await pool.query<{ name: string; phone: string | null }>(
      'SELECT name, phone FROM users WHERE user_id = $1',
      [userId],
    );
    expect(users.rows[0]).toEqual({ name: 'ทดสอบ', phone: null });
  });
  it('transaction helpers roll back all statements on the same client', async () => {
    await expect(
      withTransaction(pool, async (client) => {
        await client.query(
          'INSERT INTO categories (category_name) VALUES ($1)',
          ['must roll back'],
        );
        await client.query(
          'INSERT INTO categories (category_name) VALUES ($1)',
          ['must roll back'],
        );
      }),
    ).rejects.toMatchObject({ code: '23505' });
    expect(
      (
        await pool.query(
          'SELECT category_id FROM categories WHERE category_name = $1',
          ['must roll back'],
        )
      ).rowCount,
    ).toBe(0);
    await expect(
      withTransaction(
        pool,
        async (client) => (await client.query('SELECT 42 AS answer')).rows[0],
      ),
    ).resolves.toEqual({ answer: 42 });
  });
  it('serves live/ready, authenticates without leaking hashes, rotates and stores hashed tokens', async () => {
    expect((await apiHandlers.live(request('health/live'))).status).toBe(200);
    expect((await apiHandlers.ready(request('health/ready'))).status).toBe(200);
    expect(
      (
        await apiHandlers.login(
          request('auth/login', 'POST', {
            email: 'first@example.test',
            password: 'wrong',
          }),
        )
      ).status,
    ).toBe(401);
    const response = await apiHandlers.login(
      request('auth/login', 'POST', {
        email: ' \tFIRST@example.test\u00a0',
        password,
      }),
    );
    expect(response.status).toBe(200);
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect(cookie).toMatch(/^lost_found_session=[\w-]{43}$/);
    expect(await response.text()).not.toMatch(/password|hash|token/);
    const token = cookie.split('=')[1] ?? '';
    expect(
      (
        await pool.query(
          'SELECT token_hash FROM auth_sessions WHERE token_hash = $1',
          [hashSessionToken(token)],
        )
      ).rowCount,
    ).toBe(1);
    const loginOther = await apiHandlers.login(
      request('auth/login', 'POST', { email: 'other@example.test', password }),
    );
    otherCookie = loginOther.headers.get('set-cookie')?.split(';')[0] ?? '';
    const me = await apiHandlers.me(
      request('auth/me', 'GET', undefined, cookie),
    );
    expect((await json(me)).data.userId).toBe(userId);
    expect((await apiHandlers.me(request('auth/me'))).status).toBe(401);
  });
  it('preserves the category assignment and rejects unauthenticated/cross-origin writes', async () => {
    for (const [path, handler, task, service] of [
      [
        'categories',
        apiHandlers.categories,
        'BE002',
        createServices(pool).categories,
      ],
    ] as const) {
      const response = await handler(request(path));
      const requestId = response.headers.get('X-Request-Id');
      expect(response.status).toBe(501);
      expect(requestId).toMatch(
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: `${task} is awaiting implementation`,
          requestId,
        },
      });
      await expect(
        service.list({ limit: 20, offset: 0 }),
      ).rejects.toMatchObject({
        code: 'NOT_IMPLEMENTED',
        status: 501,
      });
    }
    expect(
      (await apiHandlers.createReport(request('item-reports', 'POST', {})))
        .status,
    ).toBe(401);
    const response = await apiHandlers.createReport(
      new Request(`${origin}/api/v1/item-reports`, {
        method: 'POST',
        headers: { origin: 'https://evil.test', cookie },
      }),
    );
    expect(response.status).toBe(403);
  });
  it('lists actual locations with ordered pagination and nullable details', async () => {
    const inserted = await pool.query<{
      location_id: number;
      location_name: string;
      detail: string | null;
    }>(
      `INSERT INTO locations (location_name, detail) VALUES ($1, $2), ($3, $4)
       RETURNING location_id, location_name, detail`,
      [
        'Integration location A',
        'North entrance',
        'Integration location B',
        null,
      ],
    );
    try {
      const expected = [
        { locationId, locationName: 'Test only location', detail: null },
        ...inserted.rows.map((row) => ({
          locationId: row.location_id,
          locationName: row.location_name,
          detail: row.detail,
        })),
      ];
      for (const [query, limit, offset] of [
        ['', 20, 0],
        ['?limit=2&offset=0', 2, 0],
        ['?limit=2&offset=2', 2, 2],
        ['?offset=100000', 20, 100000],
      ] as const) {
        const response = await apiHandlers.locations(
          request(`locations${query}`),
        );
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Request-Id')).toMatch(/^[a-f0-9-]{36}$/);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(await response.json()).toEqual({
          data: expected.slice(offset, offset + limit),
          meta: { limit, offset },
        });
      }
      expect(
        await createServices(pool).locations.list({ limit: 20, offset: 0 }),
      ).toEqual(expected);
    } finally {
      await pool.query(
        'DELETE FROM locations WHERE location_id=ANY($1::integer[])',
        [inserted.rows.map((row) => row.location_id)],
      );
    }
  });
  it('rejects malformed, unknown and duplicate location parameters', async () => {
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=1.5',
      'limit=abc',
      'offset=-1',
      'offset=100001',
      'unknown=1',
      'limit=1&limit=2',
    ]) {
      const response = await apiHandlers.locations(
        request(`locations?${query}`),
      );
      expect(response.status).toBe(422);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.requestId).toBe(response.headers.get('X-Request-Id'));
    }
  });
  it('creates reports with session identity, OPEN default and UTC dates', async () => {
    const body = {
      categoryId,
      locationId,
      type: 'FOUND',
      title: "กระเป๋า '); DROP TABLE users; --",
      eventDatetime: '2026-11-04T12:30:00+07:00',
    };
    expect(
      (
        await apiHandlers.createReport(
          request('item-reports', 'POST', { ...body, userId: otherId }, cookie),
        )
      ).status,
    ).toBe(422);
    const response = await apiHandlers.createReport(
      request('item-reports', 'POST', body, cookie),
    );
    expect(response.status).toBe(201);
    const result = await json(response);
    reportId = Number(result.data.reportId);
    expect(result.data.status).toBe('OPEN');
    expect(result.data.createdAt).toEqual(expect.stringMatching(/Z$/));
    expect(result.data.updatedAt).toBe(result.data.createdAt);
    expect(result.data.eventDatetime).toBe('2026-11-04T05:30:00.000Z');
    expect(result.data).not.toHaveProperty('userId');
    expect(
      (
        await pool.query<{ user_id: number }>(
          'SELECT user_id FROM item_reports WHERE report_id = $1',
          [reportId],
        )
      ).rows[0]?.user_id,
    ).toBe(userId);
    expect(
      (
        await apiHandlers.getReport(
          request(`item-reports/${reportId}`),
          context(reportId),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await apiHandlers.getReport(
          request('item-reports/2147483647'),
          context(2147483647),
        )
      ).status,
    ).toBe(404);
  });
  it('enforces SQL FK, CHECK and date constraints without leaking internals', async () => {
    const values = [
      userId,
      categoryId,
      locationId,
      'LOST',
      'Constraint test',
      '2026-11-04T00:00:00Z',
    ];
    const insert =
      'INSERT INTO item_reports (user_id, category_id, location_id, type, title, event_datetime) VALUES ($1,$2,$3,$4,$5,$6)';
    await expect(
      pool.query(insert, [2147483647, ...values.slice(1)]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(insert, [...values.slice(0, 3), 'OTHER', ...values.slice(4)]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query('UPDATE item_reports SET status = $1 WHERE report_id = $2', [
        'INVALID',
        reportId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    const failure = await apiHandlers.createReport(
      request(
        'item-reports',
        'POST',
        {
          categoryId: 2147483647,
          locationId,
          type: 'LOST',
          title: 'missing ref',
          eventDatetime: '2026-11-04T00:00:00Z',
        },
        cookie,
      ),
    );
    expect(failure.status).toBe(422);
    expect(await failure.text()).not.toMatch(
      /item_reports|23503|constraint|postgresql|password/,
    );
  });
  it('filters safely with bound values, limits pages, and scopes report updates to the owner', async () => {
    const repository = new PgReportRepository(pool);
    // Bypass the HTTP schema deliberately to prove repository values are still bound safely.
    expect(
      await repository.list({
        type: "FOUND' OR '1'='1" as 'FOUND',
        limit: 20,
        offset: 0,
      }),
    ).toEqual([]);
    expect((await pool.query('SELECT user_id FROM users')).rowCount).toBe(2);
    expect(
      (await apiHandlers.listReports(request('item-reports?limit=101'))).status,
    ).toBe(422);
    expect(
      (await apiHandlers.listReports(request('item-reports?status=APPROVED')))
        .status,
    ).toBe(422);
    expect(
      (
        await apiHandlers.listReports(
          request('item-reports?limit=1&offset=0&type=FOUND'),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await apiHandlers.patchReport(
          request(
            `item-reports/${reportId}`,
            'PATCH',
            { title: 'Other edit' },
            otherCookie,
          ),
          context(reportId),
        )
      ).status,
    ).toBe(404);
    expect(
      await repository.updateOwned(reportId, otherId, {
        title: 'Bypass attempt',
      }),
    ).toBeNull();
    expect(
      (
        await apiHandlers.patchReport(
          request(
            `item-reports/${reportId}`,
            'PATCH',
            { status: 'RESOLVED' },
            cookie,
          ),
          context(reportId),
        )
      ).status,
    ).toBe(422);
    const update = await apiHandlers.patchReport(
      request(
        `item-reports/${reportId}`,
        'PATCH',
        { title: 'Updated', description: null },
        cookie,
      ),
      context(reportId),
    );
    expect((await json(update)).data.title).toBe('Updated');
  });
  it('creates PENDING claims and prevents evidence access by other users including report owner', async () => {
    const response = await apiHandlers.createClaim(
      request(
        'claims',
        'POST',
        { reportId, evidence: 'Private receipt identifying marks' },
        otherCookie,
      ),
    );
    expect(response.status).toBe(201);
    const claim = (await json(response)).data;
    claimId = Number(claim.claimId);
    expect(claim.status).toBe('PENDING');
    expect(claim.userId).toBe(otherId);
    expect(claim.claimDate).toMatch(/Z$/);
    expect(claim.updatedAt).toBe(claim.claimDate);
    expect(
      (
        await apiHandlers.getClaim(
          request(`claims/${claimId}`, 'GET', undefined, cookie),
          context(claimId),
        )
      ).status,
    ).toBe(404);
    expect(
      await (
        await apiHandlers.listClaims(
          request('claims', 'GET', undefined, cookie),
        )
      ).json(),
    ).toEqual({ data: [], meta: { limit: 20, offset: 0 } });
    expect(
      (
        await apiHandlers.getClaim(
          request(`claims/${claimId}`, 'GET', undefined, otherCookie),
          context(claimId),
        )
      ).status,
    ).toBe(200);
    await expect(
      pool.query('UPDATE claims SET status = $1 WHERE claim_id = $2', [
        'OPEN',
        claimId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    expect(
      (
        await apiHandlers.createClaim(
          request(
            'claims',
            'POST',
            { reportId: 2147483647, evidence: 'Missing report' },
            cookie,
          ),
        )
      ).status,
    ).toBe(422);
  });
  it('atomically throttles concurrent account login attempts across repository instances', async () => {
    const key = hashSessionToken('rate-limit-account');
    const a = new PgAuthRepository(pool);
    const b = new PgAuthRepository(pool);
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        (index % 2 ? a : b).consumeLoginAttempt(key),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(10);
    await pool.query(
      "UPDATE auth_login_throttles SET window_start = CURRENT_TIMESTAMP - INTERVAL '16 minutes' WHERE key_hash = $1",
      [key],
    );
    expect(await a.consumeLoginAttempt(key)).toBe(true);
  });
  it('rotates login sessions, enforces expiration, and revokes idempotently on logout', async () => {
    const rotated = await apiHandlers.login(
      request(
        'auth/login',
        'POST',
        { email: 'first@example.test', password },
        cookie,
      ),
    );
    const newCookie = rotated.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect(newCookie).not.toBe(cookie);
    expect(
      (await apiHandlers.me(request('auth/me', 'GET', undefined, cookie)))
        .status,
    ).toBe(401);
    const token = newCookie.split('=')[1] ?? '';
    await pool.query(
      "UPDATE auth_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE token_hash = $1",
      [hashSessionToken(token)],
    );
    expect(
      (await apiHandlers.me(request('auth/me', 'GET', undefined, newCookie)))
        .status,
    ).toBe(401);
    const logout = await apiHandlers.logout(
      request('auth/logout', 'POST', undefined, otherCookie),
    );
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(
      (await apiHandlers.me(request('auth/me', 'GET', undefined, otherCookie)))
        .status,
    ).toBe(401);
    expect(
      (
        await apiHandlers.logout(
          request('auth/logout', 'POST', undefined, otherCookie),
        )
      ).status,
    ).toBe(200);
  });
  it('guards the provisioning CLI and stores only an adaptive hash for an explicit development account', async () => {
    const args = [
      '--conditions=react-server',
      '--import',
      'tsx',
      'packages/database/scripts/create-user.ts',
    ];
    const env = {
      ...process.env,
      DATABASE_URL: testUrl,
      PGOPTIONS: `-c search_path=${schema}`,
      PROVISION_NAME: 'Temporary CLI user',
      PROVISION_EMAIL: ' \tCLI@EXAMPLE.test\u00a0',
      PROVISION_PASSWORD: password,
    };
    const production = spawnSync(
      process.execPath,
      [...args, '--development-only'],
      {
        env: { ...env, NODE_ENV: 'production' },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    expect(production.status).toBe(1);
    expect(production.stderr).toContain('Development provisioning');
    const missingFlag = spawnSync(process.execPath, args, {
      env: { ...env, NODE_ENV: 'development' },
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(missingFlag.status).toBe(1);
    const created = spawnSync(
      process.execPath,
      [...args, '--development-only'],
      {
        env: { ...env, NODE_ENV: 'development' },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    expect(created.status, created.stderr).toBe(0);
    expect(created.stdout).not.toContain(password);
    const row = (
      await pool.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE email = $1',
        ['cli@example.test'],
      )
    ).rows[0];
    expect(row?.password_hash).toMatch(/^\$argon2id\$/);
    expect(row?.password_hash).not.toBe(password);
  });
});
