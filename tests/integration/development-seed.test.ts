import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDevelopmentAccount } from '../../packages/database/src/development-seed';
import {
  hashPassword,
  verifyPassword,
} from '../../packages/database/src/password';
import { migrate } from '../../packages/database/src/migrations';
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
});
