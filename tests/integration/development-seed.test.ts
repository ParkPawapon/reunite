import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  seedDevelopmentAccount,
  seedDevelopmentDataset,
} from '../../packages/database/src/development-seed';
import {
  hashPassword,
  verifyPassword,
} from '../../packages/database/src/password';
import { migrate } from '../../packages/database/src/migrations';
import { withTransaction } from '../../packages/database/src/transaction';
import { developmentSeedReports } from '../../packages/database/src/development-report-fixtures';
import { isolatedDatabase } from './database-fixture';

const database = isolatedDatabase();
beforeAll(async () => {
  await database.open();
  await migrate(database.pool);
});
afterAll(async () => {
  await database.close();
});

describe('development account seed in an isolated test schema', () => {
  it('creates one hashed account and preserves its data on repeated seed', async () => {
    const account = {
      name: 'Seed fixture',
      email: ' SEED@example.test ',
      password: 'Synthetic seed fixture password!',
    };
    const first = await seedDevelopmentAccount(database.pool, account);
    const before = (
      await database.pool.query('SELECT * FROM users WHERE user_id=$1', [
        first.userId,
      ])
    ).rows[0];
    expect(first.created).toBe(true);
    expect(before.email).toBe('seed@example.test');
    expect(before.password_hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(before.password_hash, account.password)).toBe(
      true,
    );
    expect(await seedDevelopmentAccount(database.pool, account)).toEqual({
      userId: first.userId,
      created: false,
    });
    const after = (
      await database.pool.query('SELECT * FROM users WHERE email=$1', [
        'seed@example.test',
      ])
    ).rows;
    expect(after).toEqual([before]);
  });
  it('preserves an existing account when supplied credentials differ', async () => {
    const hash = await hashPassword('Existing account fixture password!');
    await database.pool.query(
      'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3)',
      ['Existing fixture', 'existing@example.test', hash],
    );
    await expect(
      seedDevelopmentAccount(database.pool, {
        name: 'Replacement',
        email: 'existing@example.test',
        password: 'Different fixture password!',
      }),
    ).rejects.toThrow('data was preserved');
    expect(
      (
        await database.pool.query(
          'SELECT name,password_hash FROM users WHERE email=$1',
          ['existing@example.test'],
        )
      ).rows,
    ).toEqual([{ name: 'Existing fixture', password_hash: hash }]);
  });
  it('concurrent runs still create a single account', async () => {
    const account = {
      name: 'Concurrent fixture',
      email: 'concurrent@example.test',
      password: 'Concurrent seed fixture password!',
    };
    const results = await Promise.all([
      seedDevelopmentAccount(database.pool, account),
      seedDevelopmentAccount(database.pool, account),
    ]);
    expect(new Set(results.map((row) => row.userId)).size).toBe(1);
    expect(results.filter((row) => row.created)).toHaveLength(1);
    expect(
      (
        await database.pool.query('SELECT user_id FROM users WHERE email=$1', [
          account.email,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it('seeds categories, locations, item reports, and claims idempotently', async () => {
    const owner = await seedDevelopmentAccount(database.pool, {
      name: 'Dataset owner',
      email: 'dataset-owner@example.test',
      password: 'Dataset owner fixture password!',
    });
    const unrelated = await seedDevelopmentAccount(database.pool, {
      name: 'Unrelated owner',
      email: 'unrelated-seed@example.test',
      password: 'Unrelated seed fixture password!',
    });
    const original = developmentSeedReports[0];
    if (!original) throw new Error('Missing first seed fixture');
    const category = await database.pool.query(
      'INSERT INTO categories(category_name) VALUES($1) RETURNING category_id',
      ['Unrelated category'],
    );
    const location = await database.pool.query(
      'INSERT INTO locations(location_name) VALUES($1) RETURNING location_id',
      ['Unrelated location'],
    );
    const unrelatedReport = (
      await database.pool.query(
        `INSERT INTO item_reports(user_id,category_id,location_id,type,title,event_datetime)
       VALUES($1,$2,$3,$4,$5,$6::timestamptz) RETURNING *`,
        [
          unrelated.userId,
          category.rows[0].category_id,
          location.rows[0].location_id,
          original.type,
          original.title,
          original.eventDatetime,
        ],
      )
    ).rows[0];
    const ownerBefore = (
      await database.pool.query('SELECT * FROM users WHERE user_id=$1', [
        owner.userId,
      ])
    ).rows[0];
    const first = await withTransaction(database.pool, (client) =>
      seedDevelopmentDataset(client, owner.userId),
    );
    expect(first.categoryIds).toHaveLength(5);
    expect(first.locationIds).toHaveLength(5);
    expect(first.reportIds).toHaveLength(40);
    expect(first.ownedClaimIds).toHaveLength(2);
    expect(first.peerClaimIds).toHaveLength(1);

    const second = await withTransaction(database.pool, (client) =>
      seedDevelopmentDataset(client, owner.userId),
    );
    expect(second).toEqual(first);
    expect(first.reportIds).not.toContain(unrelatedReport.report_id);
    expect(
      (
        await database.pool.query(
          'SELECT * FROM item_reports WHERE report_id=$1',
          [unrelatedReport.report_id],
        )
      ).rows,
    ).toEqual([unrelatedReport]);
    expect(
      (
        await database.pool.query('SELECT * FROM users WHERE user_id=$1', [
          owner.userId,
        ])
      ).rows,
    ).toEqual([ownerBefore]);
    expect(
      (
        await database.pool.query(
          'SELECT type,count(*)::integer AS count FROM item_reports WHERE report_id=ANY($1::integer[]) GROUP BY type ORDER BY type',
          [first.reportIds],
        )
      ).rows,
    ).toEqual([
      { type: 'FOUND', count: 20 },
      { type: 'LOST', count: 20 },
    ]);
  });
  it('serializes simultaneous full dataset imports without duplicate reports or locations', async () => {
    const fresh = isolatedDatabase();
    try {
      await fresh.open();
      await migrate(fresh.pool);
      const owner = await seedDevelopmentAccount(fresh.pool, {
        name: 'Concurrent dataset fixture',
        email: 'dataset-concurrent@example.test',
        password: 'Concurrent dataset fixture password!',
      });
      const [first, second] = await Promise.all([
        withTransaction(fresh.pool, (client) =>
          seedDevelopmentDataset(client, owner.userId),
        ),
        withTransaction(fresh.pool, (client) =>
          seedDevelopmentDataset(client, owner.userId),
        ),
      ]);
      expect(second).toEqual(first);
      expect(
        (
          await fresh.pool.query(`SELECT
        (SELECT count(*)::integer FROM users) AS users,
        (SELECT count(*)::integer FROM categories) AS categories,
        (SELECT count(*)::integer FROM locations) AS locations,
        (SELECT count(*)::integer FROM item_reports) AS reports,
        (SELECT count(*)::integer FROM claims) AS claims`)
        ).rows,
      ).toEqual([
        { users: 2, categories: 5, locations: 5, reports: 40, claims: 3 },
      ]);
    } finally {
      await fresh.close();
    }
  });
  it('rolls back the complete seed when its transaction fails', async () => {
    const fresh = isolatedDatabase();
    try {
      await fresh.open();
      await migrate(fresh.pool);
      await expect(
        withTransaction(fresh.pool, async (client) => {
          const owner = await seedDevelopmentAccount(client, {
            name: 'Rollback fixture',
            email: 'dataset-rollback@example.test',
            password: 'Rollback dataset fixture password!',
          });
          await seedDevelopmentDataset(client, owner.userId);
          throw new Error('Synthetic failure before commit');
        }),
      ).rejects.toThrow('Synthetic failure before commit');
      expect(
        (
          await fresh.pool.query(`SELECT
        (SELECT count(*)::integer FROM users) AS users,
        (SELECT count(*)::integer FROM categories) AS categories,
        (SELECT count(*)::integer FROM locations) AS locations,
        (SELECT count(*)::integer FROM item_reports) AS reports,
        (SELECT count(*)::integer FROM claims) AS claims`)
        ).rows,
      ).toEqual([
        { users: 0, categories: 0, locations: 0, reports: 0, claims: 0 },
      ]);
    } finally {
      await fresh.close();
    }
  });
});
