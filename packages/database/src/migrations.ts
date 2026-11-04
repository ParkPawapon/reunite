import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

export type Migration = { version: string; checksum: string; sql: string };
type Applied = { version: string; checksum: string };
const migrationDirectory = fileURLToPath(
  new URL('../migrations/', import.meta.url),
);
const lockId = 78234691;

export async function readMigrations(
  directory = migrationDirectory,
): Promise<Migration[]> {
  const names = (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const versions = new Set<string>();
  return Promise.all(
    names.map(async (name) => {
      const version = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(name)?.[1];
      if (!version || versions.has(version))
        throw new Error(`Invalid or duplicate migration filename: ${name}`);
      versions.add(version);
      const sql = await readFile(`${directory}/${name}`, 'utf8');
      return {
        version,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}
export function validateHistory(migrations: Migration[], applied: Applied[]) {
  if (
    new Set(migrations.map((m) => m.version)).size !== migrations.length ||
    migrations.some(
      (m, i) => i > 0 && m.version <= (migrations[i - 1]?.version ?? ''),
    )
  ) {
    throw new Error('Migrations must have unique ascending versions');
  }
  for (const [index, row] of applied.entries()) {
    const migration = migrations[index];
    if (
      !migration ||
      migration.version !== row.version ||
      migration.checksum !== row.checksum
    ) {
      throw new Error(`Migration history drift at version ${row.version}`);
    }
  }
}
async function locked<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  let acquired = false;
  let discard = false;
  try {
    await client.query("SET lock_timeout = '10s'");
    await client.query('SELECT pg_advisory_lock($1)', [lockId]);
    acquired = true;
    return await action(client);
  } finally {
    try {
      if (acquired)
        await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
      await client.query('RESET lock_timeout');
    } catch {
      discard = true;
    }
    client.release(discard);
  }
}
export async function migrate(pool: Pool, migrations?: Migration[]) {
  const files = migrations ?? (await readMigrations());
  return locked(pool, async (client) => {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(4) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const { rows } = await client.query<Applied>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    validateHistory(files, rows);
    const applied: string[] = [];
    for (const migration of files.slice(rows.length)) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [migration.version, migration.checksum],
        );
        await client.query('COMMIT');
        applied.push(migration.version);
      } catch {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${migration.version} failed; transaction rolled back`,
        );
      }
    }
    return applied;
  });
}
export async function migrationStatus(pool: Pool) {
  const files = await readMigrations();
  return locked(pool, async (client) => {
    const exists = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('schema_migrations') IS NOT NULL AS exists",
    );
    const rows = exists.rows[0]?.exists
      ? (
          await client.query<Applied>(
            'SELECT version, checksum FROM schema_migrations ORDER BY version',
          )
        ).rows
      : [];
    validateHistory(files, rows);
    return files.map((file, index) => ({
      version: file.version,
      status: index < rows.length ? 'applied' : 'pending',
    }));
  });
}
