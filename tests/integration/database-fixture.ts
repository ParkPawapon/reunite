import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { databaseConfig } from '../../packages/database/src/config';

export function isolatedDatabase() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl)
    throw new Error(
      'TEST_DATABASE_URL is required; use a separate _test database',
    );
  let target: URL;
  try {
    target = new URL(testUrl);
  } catch {
    throw new Error('Invalid TEST_DATABASE_URL');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const databaseIdentity = (url: URL) =>
    `${localHosts.has(url.hostname) ? 'loopback' : url.hostname}:${url.port || '5432'}${url.pathname}`;
  if (
    !/^[a-zA-Z0-9_]+_test$/.test(target.pathname.slice(1)) ||
    (process.env.DATABASE_URL &&
      databaseIdentity(target) ===
        databaseIdentity(new URL(process.env.DATABASE_URL)))
  ) {
    throw new Error(
      'Integration tests require a separate database ending in _test',
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
  let created = false;
  return {
    pool,
    schema,
    async open() {
      await admin.query(`CREATE SCHEMA ${schema}`);
      created = true;
    },
    async close() {
      await pool.end();
      try {
        if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      } finally {
        await admin.end();
      }
    },
  };
}
