import { readFileSync, existsSync } from 'node:fs';
import { Pool } from 'pg';
import { databaseConfig } from '../../packages/database/src/config';

// Only the currently registered browser-test schema may be altered by recovery tests.
export async function isolatedServerDatabase() {
  if (process.env.PLAYWRIGHT_BASE_URL)
    throw new Error('Recovery fixtures require the managed test server');
  if (existsSync('.env.test')) process.loadEnvFile('.env.test');
  const testUrl = process.env.TEST_DATABASE_URL;
  if (
    !testUrl ||
    !/^[a-zA-Z0-9_]+_test$/.test(new URL(testUrl).pathname.slice(1)) ||
    testUrl === process.env.DATABASE_URL
  )
    throw new Error('Dedicated test database required');
  const record: unknown = JSON.parse(
    readFileSync('tmp/browser-test-server/schema.json', 'utf8'),
  );
  const target = new URL(testUrl);
  const identity = `${target.hostname}:${target.port || '5432'}${target.pathname}`;
  if (
    typeof record !== 'object' ||
    record === null ||
    !('schema' in record) ||
    typeof record.schema !== 'string' ||
    !/^test_[a-f0-9]{16}$/.test(record.schema) ||
    !('database' in record) ||
    record.database !== identity
  )
    throw new Error('Unrecognized disposable test schema');
  const pool = new Pool({
    ...databaseConfig({
      DATABASE_URL: testUrl,
      DB_POOL_MAX: '2',
      DB_SSL: process.env.DB_SSL,
      DB_SSL_CA: process.env.DB_SSL_CA,
    }),
    options: `-c search_path=${record.schema}`,
  });
  if (
    (await pool.query('SELECT current_schema() AS schema')).rows[0]?.schema !==
    record.schema
  ) {
    await pool.end();
    throw new Error('Schema scope mismatch');
  }
  return pool;
}
