import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import {
  migrate,
  readMigrations,
} from '../../packages/database/src/migrations';
import { cleanupExpiredAuth } from '../../packages/database/src/auth-maintenance';
import { hashSessionToken } from '@/lib/security/session';
import { normalizeEmail } from '@campus/shared';
import { isolatedDatabase } from './database-fixture';

const fixture = isolatedDatabase();
const pool = fixture.pool;
let userId: number;
let categoryId: number;
let locationId: number;
let reportId: number;
let claimId: number;
const eventDatetime = '2000-01-01T03:00:00.000Z';
const claimDate = '2001-01-01T04:00:00.000Z';

async function seedLegacy(db: Pool, email = ' \tLegacy@EXAMPLE.test\u00a0') {
  const user = (
    await db.query<{ user_id: number }>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING user_id',
      ['Legacy user', email, 'unused test hash'],
    )
  ).rows[0]?.user_id;
  const category = (
    await db.query<{ category_id: number }>(
      'INSERT INTO categories (category_name) VALUES ($1) RETURNING category_id',
      ['Synthetic category'],
    )
  ).rows[0]?.category_id;
  const location = (
    await db.query<{ location_id: number }>(
      'INSERT INTO locations (location_name) VALUES ($1) RETURNING location_id',
      ['Synthetic location'],
    )
  ).rows[0]?.location_id;
  if (!user || !category || !location)
    throw new Error('Missing legacy seed IDs');
  const report = (
    await db.query<{ report_id: number }>(
      `INSERT INTO item_reports (user_id, category_id, location_id, type, title, event_datetime)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING report_id`,
      [user, category, location, 'FOUND', 'Legacy report', eventDatetime],
    )
  ).rows[0]?.report_id;
  if (!report) throw new Error('Missing report ID');
  const claim = (
    await db.query<{ claim_id: number }>(
      'INSERT INTO claims (report_id,user_id,evidence,claim_date) VALUES ($1,$2,$3,$4) RETURNING claim_id',
      [report, user, 'Synthetic evidence', claimDate],
    )
  ).rows[0]?.claim_id;
  if (!claim) throw new Error('Missing claim ID');
  return { user, category, location, report, claim };
}

beforeAll(async () => {
  await fixture.open();
  await migrate(pool, (await readMigrations()).slice(0, 3));
  const ids = await seedLegacy(pool);
  userId = ids.user;
  categoryId = ids.category;
  locationId = ids.location;
  reportId = ids.report;
  claimId = ids.claim;
});
afterAll(() => fixture.close());

describe('safe upgrade and database-enforced integrity', () => {
  it('upgrades legacy rows without fabricating event times or changing the table count', async () => {
    expect(await migrate(pool, (await readMigrations()).slice(0, 4))).toEqual([
      '0004',
    ]);
    const [user] = (
      await pool.query<{ email: string; created_at: Date; updated_at: Date }>(
        'SELECT email, created_at, updated_at FROM users WHERE user_id=$1',
        [userId],
      )
    ).rows;
    expect(user?.email).toBe('legacy@example.test');
    expect(user?.created_at).toEqual(user?.updated_at);
    const [report] = (
      await pool.query<{
        event_datetime: Date;
        created_at: Date;
        updated_at: Date;
      }>(
        'SELECT event_datetime, created_at, updated_at FROM item_reports WHERE report_id=$1',
        [reportId],
      )
    ).rows;
    expect(report?.event_datetime.toISOString()).toBe(eventDatetime);
    expect(report?.created_at.toISOString()).not.toBe(eventDatetime);
    expect(report?.created_at).toEqual(report?.updated_at);
    const [claim] = (
      await pool.query<{ claim_date: Date; updated_at: Date }>(
        'SELECT claim_date, updated_at FROM claims WHERE claim_id=$1',
        [claimId],
      )
    ).rows;
    expect(claim?.claim_date.toISOString()).toBe(claimDate);
    expect(claim?.updated_at.toISOString()).toBe(claimDate);
    expect(
      (
        await pool.query<{ count: number }>(
          'SELECT count(*)::integer AS count FROM information_schema.tables WHERE table_schema=$1',
          [fixture.schema],
        )
      ).rows[0]?.count,
    ).toBe(8);
    expect(await migrate(pool, (await readMigrations()).slice(0, 4))).toEqual(
      [],
    );
  });

  it('normalizes SQL INSERT and UPDATE emails and rejects case/whitespace duplicates', async () => {
    await expect(
      pool.query(
        'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3)',
        ['Duplicate', '\u3000LEGACY@EXAMPLE.TEST\t', 'unused hash'],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    const [row] = (
      await pool.query<{ user_id: number; email: string }>(
        'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING user_id,email',
        ['Second', '\nSecond@EXAMPLE.test\u00a0', 'unused hash'],
      )
    ).rows;
    expect(row?.email).toBe(normalizeEmail('\nSecond@EXAMPLE.test\u00a0'));
    await expect(
      pool.query('UPDATE users SET email=$1 WHERE user_id=$2', [
        ' Legacy@example.test ',
        row?.user_id,
      ]),
    ).rejects.toMatchObject({ code: '23505' });
    const changed = await pool.query<{ email: string }>(
      'UPDATE users SET email=$1 WHERE user_id=$2 RETURNING email',
      ['\uFEFFChanged@EXAMPLE.test\u2029', row?.user_id],
    );
    expect(changed.rows[0]?.email).toBe('changed@example.test');
  });

  it.each(['', '   ', '\t\n\r', '\u00a0\u3000', '\u2003\u2029\uFEFF'])(
    'rejects blank required text at the database boundary: %j',
    async (blank) => {
      const operations = [
        ['UPDATE users SET name=$1 WHERE user_id=$2', userId],
        ['UPDATE users SET email=$1 WHERE user_id=$2', userId],
        [
          'UPDATE categories SET category_name=$1 WHERE category_id=$2',
          categoryId,
        ],
        [
          'UPDATE locations SET location_name=$1 WHERE location_id=$2',
          locationId,
        ],
        ['UPDATE item_reports SET title=$1 WHERE report_id=$2', reportId],
        ['UPDATE claims SET evidence=$1 WHERE claim_id=$2', claimId],
      ] as const;
      for (const [sql, id] of operations)
        await expect(pool.query(sql, [blank, id])).rejects.toMatchObject({
          code: '23514',
        });
    },
  );

  it('maintains updated_at on direct writes while preserving creation and event dates', async () => {
    const original = (
      await pool.query<{ created_at: Date }>(
        'SELECT created_at FROM item_reports WHERE report_id=$1',
        [reportId],
      )
    ).rows[0]?.created_at;
    await pool.query('SELECT pg_sleep(0.01)');
    const user = await pool.query<{ updated_at: Date }>(
      "UPDATE users SET phone=$1, updated_at='1990-01-01T00:00:00Z' WHERE user_id=$2 RETURNING updated_at",
      ['0000000000', userId],
    );
    expect(user.rows[0]?.updated_at.getUTCFullYear()).toBeGreaterThan(2001);
    const report = await pool.query<{
      created_at: Date;
      updated_at: Date;
      event_datetime: Date;
    }>(
      "UPDATE item_reports SET title=$1, updated_at='1990-01-01T00:00:00Z' WHERE report_id=$2 RETURNING created_at,updated_at,event_datetime",
      ['Revised report', reportId],
    );
    expect(report.rows[0]?.created_at).toEqual(original);
    expect(report.rows[0]?.event_datetime.toISOString()).toBe(eventDatetime);
    expect(report.rows[0]?.updated_at.getTime()).toBeGreaterThan(
      original?.getTime() ?? 0,
    );
    const claim = await pool.query<{ claim_date: Date; updated_at: Date }>(
      "UPDATE claims SET evidence=$1, updated_at='1990-01-01T00:00:00Z' WHERE claim_id=$2 RETURNING claim_date,updated_at",
      ['Revised synthetic evidence', claimId],
    );
    expect(claim.rows[0]?.claim_date.toISOString()).toBe(claimDate);
    expect(claim.rows[0]?.updated_at.getUTCFullYear()).toBeGreaterThan(2001);
  });

  it('keeps non-cascading business foreign keys and session-only cascade behavior', async () => {
    for (const [sql, id] of [
      ['DELETE FROM users WHERE user_id=$1', userId],
      ['DELETE FROM categories WHERE category_id=$1', categoryId],
      ['DELETE FROM locations WHERE location_id=$1', locationId],
      ['DELETE FROM item_reports WHERE report_id=$1', reportId],
    ] as const)
      await expect(pool.query(sql, [id])).rejects.toMatchObject({
        code: '23503',
      });
    const keys = await pool.query<{ confdeltype: string }>(
      `SELECT confdeltype FROM pg_constraint
      WHERE connamespace=$1::regnamespace AND contype='f' AND conrelid <> 'auth_sessions'::regclass`,
      [fixture.schema],
    );
    expect(keys.rows).toHaveLength(5);
    expect(keys.rows.every((key) => key.confdeltype === 'a')).toBe(true);
    const disposable = (
      await pool.query<{ user_id: number }>(
        'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING user_id',
        ['Session-only user', 'session-only@example.test', 'unused hash'],
      )
    ).rows[0]?.user_id;
    const tokenHash = hashSessionToken('cascade-test');
    await pool.query(
      "INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,CURRENT_TIMESTAMP + INTERVAL '1 day')",
      [tokenHash, disposable],
    );
    await pool.query('DELETE FROM users WHERE user_id=$1', [disposable]);
    expect(
      (
        await pool.query(
          'SELECT token_hash FROM auth_sessions WHERE token_hash=$1',
          [tokenHash],
        )
      ).rowCount,
    ).toBe(0);
  });

  it('replaces only redundant indexes and keeps one canonical email unique index', async () => {
    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      'SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1',
      [fixture.schema],
    );
    expect(
      indexes.rows.find((index) => index.indexname === 'claims_user_claim_idx')
        ?.indexdef,
    ).toContain('(user_id, claim_id DESC)');
    expect(
      indexes.rows.find(
        (index) => index.indexname === 'item_reports_type_status_report_idx',
      )?.indexdef,
    ).toContain('(type, status, report_id DESC)');
    expect(
      indexes.rows.some((index) =>
        ['claims_user_idx', 'item_reports_type_idx'].includes(index.indexname),
      ),
    ).toBe(false);
    expect(
      indexes.rows.filter(
        (index) =>
          index.indexdef.includes('UNIQUE INDEX') &&
          index.indexdef.includes('(email)'),
      ),
    ).toHaveLength(1);
  });

  it('does not introduce an unapproved claim-eligibility or duplicate-request policy', async () => {
    await expect(
      pool.query(
        'INSERT INTO claims (report_id,user_id,evidence) VALUES ($1,$2,$3)',
        [reportId, userId, 'Second synthetic request'],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('previews bounded auth cleanup, skips locked expired rows and preserves live state', async () => {
    for (const [key, interval] of [
      ['expired-a', '-2 days'],
      ['expired-b', '-1 day'],
      ['live', '1 day'],
    ] as const) {
      await pool.query(
        'INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,CURRENT_TIMESTAMP + $3::interval)',
        [hashSessionToken(key), userId, interval],
      );
    }
    await pool.query(
      "INSERT INTO auth_login_throttles (key_hash,window_start,attempts) VALUES ($1,CURRENT_TIMESTAMP - INTERVAL '16 minutes',1),($2,CURRENT_TIMESTAMP,1)",
      [hashSessionToken('old throttle'), hashSessionToken('live throttle')],
    );
    expect(await cleanupExpiredAuth(pool, { batchSize: 1 })).toEqual({
      mode: 'dry-run',
      sessions: 1,
      loginThrottles: 1,
      batchSize: 1,
    });
    expect(
      (await pool.query('SELECT token_hash FROM auth_sessions')).rowCount,
    ).toBe(3);
    const locked = await pool.connect();
    try {
      await locked.query('BEGIN');
      await locked.query(
        'SELECT token_hash FROM auth_sessions WHERE token_hash=$1 FOR UPDATE',
        [hashSessionToken('expired-a')],
      );
      expect(
        await cleanupExpiredAuth(pool, { apply: true, batchSize: 1 }),
      ).toEqual({
        mode: 'apply',
        sessions: 1,
        loginThrottles: 1,
        batchSize: 1,
      });
    } finally {
      await locked.query('ROLLBACK');
      locked.release();
    }
    expect((await cleanupExpiredAuth(pool, { apply: true })).sessions).toBe(1);
    expect((await cleanupExpiredAuth(pool, { apply: true })).sessions).toBe(0);
    expect(
      (await pool.query('SELECT token_hash FROM auth_sessions')).rows,
    ).toEqual([{ token_hash: hashSessionToken('live') }]);
    expect(
      (await pool.query('SELECT key_hash FROM auth_login_throttles')).rows,
    ).toEqual([{ key_hash: hashSessionToken('live throttle') }]);
    await expect(cleanupExpiredAuth(pool, { batchSize: 0 })).rejects.toThrow(
      'batch size',
    );
  });
});

it.each(['canonical-email collision', 'blank required text'])(
  'rolls back an unsafe legacy upgrade: %s',
  async (scenario) => {
    const legacy = isolatedDatabase();
    await legacy.open();
    try {
      await migrate(legacy.pool, (await readMigrations()).slice(0, 3));
      await legacy.pool.query(
        'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3)',
        ['First', 'Person@example.test', 'unused hash'],
      );
      if (scenario === 'canonical-email collision')
        await legacy.pool.query(
          'INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3)',
          ['Second', 'person@example.test', 'unused hash'],
        );
      else await legacy.pool.query('UPDATE users SET name=$1', ['\u00a0\t']);
      const before = await legacy.pool.query<{
        user_id: number;
        name: string;
        email: string;
      }>('SELECT user_id,name,email FROM users ORDER BY user_id');
      await expect(migrate(legacy.pool)).rejects.toThrow('0004');
      expect(
        (
          await legacy.pool.query(
            'SELECT user_id,name,email FROM users ORDER BY user_id',
          )
        ).rows,
      ).toEqual(before.rows);
      expect(
        (
          await legacy.pool.query(
            'SELECT version FROM schema_migrations ORDER BY version',
          )
        ).rows,
      ).toEqual([
        { version: '0001' },
        { version: '0002' },
        { version: '0003' },
      ]);
      expect(
        (
          await legacy.pool.query(
            'SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',
            [legacy.schema, 'users', 'created_at'],
          )
        ).rowCount,
      ).toBe(0);
      // An operator can correct data and retry without rewriting migration history.
      if (scenario === 'canonical-email collision')
        await legacy.pool.query('UPDATE users SET email=$1 WHERE email=$2', [
          'second@example.test',
          'person@example.test',
        ]);
      else
        await legacy.pool.query('UPDATE users SET name=$1', ['Corrected name']);
      expect(
        await migrate(legacy.pool, (await readMigrations()).slice(0, 4)),
      ).toEqual(['0004']);
      expect(
        (await legacy.pool.query('SELECT user_id FROM users')).rowCount,
      ).toBe(before.rows.length);
    } finally {
      await legacy.close();
    }
  },
);
