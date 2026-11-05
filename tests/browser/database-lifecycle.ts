import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { isolatedDatabase } from '../integration/database-fixture';

const directory = path.resolve('tmp/browser-test-server');
const manifest = path.join(directory, 'schema.json');
const identity = () => {
  const target = new URL(process.env.TEST_DATABASE_URL ?? '');
  return `${target.hostname}:${target.port || '5432'}${target.pathname}`;
};
export function registerBrowserSchema(schema: string) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(manifest, JSON.stringify({ schema, database: identity() }));
}
export async function cleanupBrowserSchema() {
  if (!existsSync(manifest)) return;
  const record: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
  if (
    typeof record !== 'object' ||
    record === null ||
    !('schema' in record) ||
    typeof record.schema !== 'string' ||
    !/^test_[a-f0-9]{16}$/.test(record.schema) ||
    !('database' in record) ||
    record.database !== identity()
  )
    throw new Error('Refusing to clean an unrecognized browser test schema');
  // Reuse the separate-database safety checks. Only this run's recorded schema is removed.
  const database = isolatedDatabase();
  try {
    await database.pool.query(`DROP SCHEMA IF EXISTS ${record.schema} CASCADE`);
    unlinkSync(manifest);
  } finally {
    await database.close();
  }
}
