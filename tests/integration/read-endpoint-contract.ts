import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { databaseConfig } from '../../packages/database/src/config';
import { migrate } from '../../packages/database/src/migrations';
import { createServices } from '@/lib/composition';
import { createHandlers } from '@/lib/http/handlers';
import { hashSessionToken } from '@/lib/security/session';
import { listReports } from '@/modules/item-reports/presentation/list-reports';
import { getReport } from '@/modules/item-reports/presentation/get-report';
import { listClaims } from '@/modules/claims/presentation/list-claims';
import { getClaim } from '@/modules/claims/presentation/get-claim';
import { listCategories } from '@/modules/categories/presentation/list-categories';

export function verifyReadEndpointContract(
  task: 'BE002' | 'BE005' | 'BE006' | 'BE007' | 'BE008',
) {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (
    !testUrl ||
    !/^[a-zA-Z0-9_]+_test$/.test(new URL(testUrl).pathname.slice(1)) ||
    testUrl === process.env.DATABASE_URL
  )
    throw new Error('A dedicated separate _test database is required');
  const schema = `test_read_${task.toLowerCase()}_${randomBytes(8).toString('hex')}`;
  const config = databaseConfig({ ...process.env, DATABASE_URL: testUrl });
  const admin = new Pool(config);
  const db = new Pool({ ...config, options: `-c search_path=${schema}` });
  const handlers = createHandlers({
    services: () => createServices(db),
    ping: async () => {
      await db.query('SELECT 1');
    },
  });
  const token = randomBytes(32).toString('base64url');
  const peerToken = randomBytes(32).toString('base64url');
  const emptyToken = randomBytes(32).toString('base64url');
  const expiredToken = randomBytes(32).toString('base64url');
  const cookie = (value: string) => `review_session=${value}`;
  const request = (path: string, session?: string) =>
    new Request(`http://localhost:3000/api/v1/${path}`, {
      headers: session ? { cookie: session } : {},
    });
  const ctx = (id: number | string) => ({
    params: Promise.resolve({ id: String(id) }),
  });
  const badQuery = [
    'limit=0',
    'limit=101',
    'limit=1.5',
    'limit=abc',
    'offset=-1',
    'offset=100001',
    'unknown=1',
    'limit=1&limit=2',
    'offset=0&offset=1',
    'userId=999',
  ];
  const badId = ['0', '-1', 'abc', '1.5', '2147483648', '99999999999'];
  const users: number[] = [],
    categories: number[] = [],
    locations: number[] = [],
    reports: number[] = [],
    claims: number[] = [];
  const reportFixtures = [
    ['LOST', 'OPEN', 0, 0],
    ['FOUND', 'OPEN', 0, 1],
    ['FOUND', 'OPEN', 1, 0],
    ['LOST', 'RESOLVED', 1, 1],
    ['FOUND', 'CLOSED', 0, 0],
    ['LOST', 'OPEN', 1, 0],
  ] as const;
  async function checked(response: Response, status: number) {
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const body: unknown = await response.json();
    if (status >= 400)
      expect(body).toMatchObject({
        error: { requestId: response.headers.get('x-request-id') },
      });
    return body;
  }
  const get = (path: string, session?: string) => {
    const req = request(path, session);
    if (task === 'BE007') return handlers.listClaims(req);
    if (task === 'BE008')
      return handlers.getClaim(
        req,
        ctx(path.split('?')[0]?.split('/').at(-1) ?? ''),
      );
    if (task === 'BE002') return handlers.categories(req);
    if (task === 'BE005') return handlers.listReports(req);
    return handlers.getReport(
      req,
      ctx(path.split('?')[0]?.split('/').at(-1) ?? ''),
    );
  };
  const base =
    task === 'BE007' || task === 'BE008'
      ? 'claims'
      : task === 'BE002'
        ? 'categories'
        : 'item-reports';
  const idOf = (body: unknown, key: string) => {
    const data = (body as { data: Record<string, unknown>[] }).data;
    return data.map((row) => row[key]);
  };
  beforeAll(async () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.SESSION_COOKIE_NAME = 'review_session';
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(db);
    for (const name of ['Owner', 'Peer', 'Empty'])
      users.push(
        (
          await db.query<{ user_id: number }>(
            'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING user_id',
            [
              name,
              `${name.toLowerCase()}@review.test`,
              'synthetic-review-only',
            ],
          )
        ).rows[0]?.user_id ?? 0,
      );
    for (const name of ['หมวดทดสอบ ก', 'หมวดทดสอบ ข', 'หมวดทดสอบ ค'])
      categories.push(
        (
          await db.query<{ category_id: number }>(
            'INSERT INTO categories(category_name) VALUES($1) RETURNING category_id',
            [name],
          )
        ).rows[0]?.category_id ?? 0,
      );
    for (const name of ['Review A', 'Review B'])
      locations.push(
        (
          await db.query<{ location_id: number }>(
            'INSERT INTO locations(location_name) VALUES($1) RETURNING location_id',
            [name],
          )
        ).rows[0]?.location_id ?? 0,
      );
    for (const [
      index,
      [type, status, category, location],
    ] of reportFixtures.entries())
      reports.push(
        (
          await db.query<{ report_id: number }>(
            `INSERT INTO item_reports(user_id,category_id,location_id,type,status,title,description,image,event_datetime) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING report_id`,
            [
              users[index % 2],
              categories[category],
              locations[location],
              type,
              status,
              `รายการทดสอบ ${index}`,
              index % 2 === 0 ? null : 'Review description',
              index % 2 === 0 ? null : '/review/image.webp',
              '2026-11-04T12:30:00+07:00',
            ],
          )
        ).rows[0]?.report_id ?? 0,
      );
    for (const [index, owner] of [users[0], users[1], users[0]].entries())
      claims.push(
        (
          await db.query<{ claim_id: number }>(
            'INSERT INTO claims(report_id,user_id,evidence,status) VALUES($1,$2,$3,$4) RETURNING claim_id',
            [
              reports[0],
              owner,
              `PRIVATE evidence ${index}`,
              ['PENDING', 'REJECTED', 'APPROVED'][index],
            ],
          )
        ).rows[0]?.claim_id ?? 0,
      );
    for (const [session, user, expiry] of [
      [token, users[0], '1 hour'],
      [peerToken, users[1], '1 hour'],
      [emptyToken, users[2], '1 hour'],
      [expiredToken, users[0], '-1 hour'],
    ] as const)
      await db.query(
        'INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP + $3::interval)',
        [hashSessionToken(session), user, expiry],
      );
  });
  afterAll(async () => {
    await db.end();
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });

  describe(`Read endpoint contract ${task}`, () => {
    if (task === 'BE007' || task === 'BE008') {
      it.each([
        undefined,
        cookie('malformed'),
        cookie(randomBytes(32).toString('base64url')),
        cookie(expiredToken),
        `${cookie(token)}; ${cookie(peerToken)}`,
      ])(
        'rejects missing/invalid/unknown/expired/duplicate sessions: %s',
        async (session) => {
          const result = await checked(
            await get(
              task === 'BE007' ? base : `${base}/${claims[0]}`,
              session,
            ),
            401,
          );
          expect(result).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
        },
      );
      it('authenticates before validating input', async () => {
        await checked(
          await get(task === 'BE007' ? `${base}?limit=0` : `${base}/abc`),
          401,
        );
      });
    }
    if (task === 'BE007' || task === 'BE002' || task === 'BE005') {
      it.each(badQuery)(
        'rejects malformed/unknown/duplicate query %s',
        async (query) => {
          expect(
            await checked(await get(`${base}?${query}`, cookie(token)), 422),
          ).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
        },
      );
      it('returns real rows, defaults, deterministic order, exact field privacy and meta', async () => {
        const response = await checked(await get(base, cookie(token)), 200);
        expect(response).toMatchObject({ meta: { limit: 20, offset: 0 } });
        const key =
          task === 'BE007'
            ? 'claimId'
            : task === 'BE002'
              ? 'categoryId'
              : 'reportId';
        const ids =
          task === 'BE007'
            ? [claims[2], claims[0]]
            : task === 'BE002'
              ? categories
              : [...reports].reverse();
        expect(idOf(response, key)).toEqual(ids);
        const rows = (response as { data: Record<string, unknown>[] }).data;
        const fields =
          task === 'BE007'
            ? [
                'claimId',
                'reportId',
                'userId',
                'evidence',
                'status',
                'claimDate',
                'updatedAt',
              ]
            : task === 'BE002'
              ? ['categoryId', 'categoryName']
              : [
                  'reportId',
                  'categoryId',
                  'locationId',
                  'type',
                  'title',
                  'description',
                  'image',
                  'eventDatetime',
                  'status',
                  'createdAt',
                  'updatedAt',
                ];
        for (const row of rows)
          expect(Object.keys(row).sort()).toEqual([...fields].sort());
        if (task === 'BE007')
          for (const row of rows) expect(row.userId).toBe(users[0]);
      });
      it('paginates using real offset and returns empty pages', async () => {
        const key =
          task === 'BE007'
            ? 'claimId'
            : task === 'BE002'
              ? 'categoryId'
              : 'reportId';
        const expected =
          task === 'BE007'
            ? claims[0]
            : task === 'BE002'
              ? categories[1]
              : reports[4];
        expect(
          idOf(
            await checked(
              await get(`${base}?limit=1&offset=1`, cookie(token)),
              200,
            ),
            key,
          ),
        ).toEqual([expected]);
        expect(
          await checked(
            await get(`${base}?limit=100&offset=100000`, cookie(token)),
            200,
          ),
        ).toEqual({ data: [], meta: { limit: 100, offset: 100000 } });
      });
      it('rejects invalid input before constructing the target service', async () => {
        const fail = () => {
          throw new Error('Service must not be created');
        };
        const req = request(`${base}?unknown=1`);
        const response =
          task === 'BE007'
            ? await listClaims(
                req,
                async () => ({
                  userId: users[0] ?? 0,
                  name: 'Owner',
                  email: 'owner@review.test',
                }),
                fail,
              )
            : task === 'BE002'
              ? await listCategories(req, fail)
              : await listReports(req, fail);
        await checked(response, 422);
      });
    }
    if (task === 'BE007')
      it('returns no rows to a valid user without claims', async () => {
        expect(await checked(await get(base, cookie(emptyToken)), 200)).toEqual(
          { data: [], meta: { limit: 20, offset: 0 } },
        );
      });
    if (task === 'BE002')
      it('reads an actually empty category table', async () => {
        const client = await db.connect();
        await client.query('BEGIN');
        try {
          await client.query('DELETE FROM claims');
          await client.query('DELETE FROM item_reports');
          await client.query('DELETE FROM categories');
          const emptyHandlers = createHandlers({
            services: () => createServices(client),
            ping: async () => {
              await client.query('SELECT 1');
            },
          });
          expect(
            await checked(await emptyHandlers.categories(request(base)), 200),
          ).toEqual({ data: [], meta: { limit: 20, offset: 0 } });
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
      });
    if (task === 'BE005') {
      it.each([
        'type=LOST',
        'type=FOUND',
        'status=OPEN',
        'status=RESOLVED',
        'status=CLOSED',
        'categoryId',
        'locationId',
      ])('filters each supplied parameter %s', async (query) => {
        // Resolve fixture IDs after beforeAll has populated the isolated schema.
        if (query === 'categoryId') query = `categoryId=${categories[0]}`;
        if (query === 'locationId') query = `locationId=${locations[0]}`;
        const [key, value] = query.split('=');
        const expected = reportFixtures
          .flatMap(([type, status, cat, loc], index) =>
            (
              ({
                type,
                status,
                categoryId: categories[cat],
                locationId: locations[loc],
              }) as Record<string, unknown>
            )[key ?? ''] ===
            (key === 'categoryId' || key === 'locationId'
              ? Number(value)
              : value)
              ? [reports[index]]
              : [],
          )
          .reverse();
        expect(
          idOf(await checked(await get(`${base}?${query}`), 200), 'reportId'),
        ).toEqual(expected);
      });
      it('combines all filters and preserves SQL nulls/UTC timestamps without owner details', async () => {
        const body = await checked(
          await get(
            `${base}?type=FOUND&status=OPEN&categoryId=${categories[1]}&locationId=${locations[0]}`,
          ),
          200,
        );
        expect(idOf(body, 'reportId')).toEqual([reports[2]]);
        expect(body).toMatchObject({
          data: [
            {
              description: null,
              image: null,
              eventDatetime: '2026-11-04T05:30:00.000Z',
            },
          ],
        });
      });
      it.each([
        'type=OTHER',
        'status=APPROVED',
        'categoryId=0',
        'locationId=2147483648',
        "type=' OR 1=1--",
      ])('rejects invalid filters %s', async (query) => {
        await checked(await get(`${base}?${query}`), 422);
      });
      it('returns no matches for a valid unknown foreign-key filter', async () => {
        expect(
          await checked(await get(`${base}?categoryId=2147483647`), 200),
        ).toMatchObject({ data: [] });
      });
    }
    if (task === 'BE008' || task === 'BE006') {
      it.each(badId)('rejects invalid path id %s', async (id) => {
        expect(
          await checked(await get(`${base}/${id}`, cookie(token)), 422),
        ).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      });
      it('returns the exact detail contract and real null/time values', async () => {
        const body = await checked(
          await get(
            `${base}/${task === 'BE008' ? claims[0] : reports[0]}`,
            cookie(token),
          ),
          200,
        );
        expect(Object.keys(body as object)).toEqual(['data']);
        const data = (body as { data: Record<string, unknown> }).data;
        const fields =
          task === 'BE008'
            ? [
                'claimId',
                'reportId',
                'userId',
                'evidence',
                'status',
                'claimDate',
                'updatedAt',
              ]
            : [
                'reportId',
                'categoryId',
                'locationId',
                'type',
                'title',
                'description',
                'image',
                'eventDatetime',
                'status',
                'createdAt',
                'updatedAt',
              ];
        expect(Object.keys(data).sort()).toEqual([...fields].sort());
        if (task === 'BE008')
          expect(data).toMatchObject({
            claimId: claims[0],
            userId: users[0],
            evidence: 'PRIVATE evidence 0',
          });
        else {
          expect(data).toMatchObject({
            reportId: reports[0],
            description: null,
            image: null,
            eventDatetime: '2026-11-04T05:30:00.000Z',
          });
          expect(data).not.toHaveProperty('userId');
        }
        const dates =
          task === 'BE008'
            ? ['claimDate', 'updatedAt']
            : ['eventDatetime', 'createdAt', 'updatedAt'];
        for (const key of dates)
          expect(data[key]).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
      });
      it('returns the documented 404 for a valid absent id', async () => {
        expect(
          await checked(await get(`${base}/2147483647`, cookie(token)), 404),
        ).toMatchObject({
          error: {
            code: 'NOT_FOUND',
            message: task === 'BE008' ? 'Claim not found' : 'Report not found',
          },
        });
      });
      it('does not construct a service before validating id', async () => {
        const fail = () => {
          throw new Error('Service must not be created');
        };
        const response =
          task === 'BE008'
            ? await getClaim(
                request(`${base}/abc`),
                ctx('abc'),
                async () => ({
                  userId: users[0] ?? 0,
                  name: 'Owner',
                  email: 'owner@review.test',
                }),
                fail,
              )
            : await getReport(request(`${base}/abc`), ctx('abc'), fail);
        await checked(response, 422);
      });
    }
    if (task === 'BE006')
      it('allows public report detail without any session cookie', async () => {
        expect(
          await checked(await get(`${base}/${reports[1]}`), 200),
        ).toMatchObject({ data: { reportId: reports[1] } });
      });
    if (task === 'BE008')
      it('hides another claimant evidence even from the underlying report owner', async () => {
        const foreign = await checked(
          await get(`${base}/${claims[1]}`, cookie(token)),
          404,
        );
        const absent = await checked(
          await get(`${base}/2147483647`, cookie(token)),
          404,
        );
        const sanitize = (value: unknown) => {
          const error = (value as { error: { code: string; message: string } })
            .error;
          return { code: error.code, message: error.message };
        };
        expect(sanitize(foreign)).toEqual(sanitize(absent));
        expect(JSON.stringify(foreign)).not.toContain('PRIVATE');
        expect(
          await checked(
            await get(`${base}/${claims[1]}`, cookie(peerToken)),
            200,
          ),
        ).toMatchObject({
          data: { userId: users[1], evidence: 'PRIVATE evidence 1' },
        });
      });
    it('sanitizes service-construction failures through the common error envelope', async () => {
      const fail = () => {
        throw new Error('PRIVATE SQL password stack');
      };
      const req = request(base);
      const owner = async () => ({
        userId: users[0] ?? 0,
        name: 'Owner',
        email: 'owner@review.test',
      });
      const response =
        task === 'BE007'
          ? await listClaims(req, owner, fail)
          : task === 'BE008'
            ? await getClaim(req, ctx('1'), owner, fail)
            : task === 'BE002'
              ? await listCategories(req, fail)
              : task === 'BE005'
                ? await listReports(req, fail)
                : await getReport(req, ctx('1'), fail);
      const body = await checked(response, 500);
      expect(body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
      expect(JSON.stringify(body)).not.toMatch(/PRIVATE|password|SQL|stack/);
    });
  });
}
