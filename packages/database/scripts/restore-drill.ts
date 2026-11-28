import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import sharp from 'sharp';
import { databaseConfig } from '../src/config';
import { migrate, migrationStatus } from '../src/migrations';

function connection(envUrl: string) {
  const url = new URL(envUrl);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    !url.username ||
    !url.password ||
    envUrl === process.env.DATABASE_URL
  ) {
    throw new Error(
      'Use a dedicated loopback TEST_DATABASE_URL ending in _test, with explicit credentials',
    );
  }
  return url;
}

function pgTool(program: 'pg_dump' | 'pg_restore', args: string[], url: URL) {
  const executable = process.env.PG_BIN_DIR
    ? join(
        process.env.PG_BIN_DIR,
        program + (process.platform === 'win32' ? '.exe' : ''),
      )
    : program;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^PG/i.test(name)),
  );
  const command = spawnSync(executable, ['--no-password', ...args], {
    env: {
      ...env,
      PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
      PGPORT: url.port || '5432',
      PGDATABASE: url.pathname.slice(1),
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: 'disable',
      PGCONNECT_TIMEOUT: '5',
    },
    timeout: 60000,
    stdio: 'ignore',
    windowsHide: true,
  });
  if (command.status !== 0)
    throw new Error(
      `${program} failed; verify tool version and access to the local rehearsal database`,
    );
}

async function fingerprint(db: Pool) {
  const result = await db.query(`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM item_reports) AS reports,
    (SELECT coalesce(sum(num_nonnulls(image_data, image_data_2, image_data_3)), 0)::int FROM item_reports) AS photos,
    (SELECT count(*)::int FROM claims) AS claims,
    (SELECT count(*)::int FROM notifications) AS notifications,
    (SELECT count(*)::int FROM report_matches) AS matches,
    (SELECT coalesce(jsonb_agg(jsonb_build_array(report_id, title, status, md5(image_data),
      md5(image_data_2), md5(image_data_3)) ORDER BY report_id), '[]') FROM item_reports) AS report_fingerprints,
    (SELECT coalesce(jsonb_agg(jsonb_build_array(c.claim_id, r.report_id, c.user_id,
      c.status, md5(c.evidence), c.claim_date) ORDER BY c.claim_id), '[]')
      FROM claims c JOIN item_reports r USING (report_id) JOIN users u ON u.user_id = c.user_id) AS claim_fingerprints`);
  return result.rows[0];
}

async function seed(db: Pool) {
  await db.query(`INSERT INTO users (name, email, password_hash)
      VALUES ('Fixture owner', 'restore-owner@example.test', 'unused-test-password-hash'),
             ('Fixture claimant', 'restore-claimant@example.test', 'unused-test-password-hash');
    INSERT INTO categories (category_name) VALUES ('Accessories');
    INSERT INTO locations (location_name) VALUES ('N7 rehearsal');
    INSERT INTO item_reports (user_id, category_id, location_id, type, title, event_datetime, status)
      VALUES (1, 1, 1, 'FOUND', 'Rehearsal bag', now(), 'OPEN'),
             (2, 1, 1, 'LOST', 'Rehearsal bag', now(), 'OPEN');
    INSERT INTO claims (report_id, user_id, evidence) VALUES (1, 2, 'Blue stitching below the strap');
    INSERT INTO notifications (user_id, kind, report_id) VALUES (1, 'CLAIM_SUBMITTED', 1);`);
  const photos = await Promise.all(
    ['#fa4616', '#ffc72c', '#7b8189'].map((background) =>
      sharp({ create: { width: 32, height: 32, channels: 3, background } })
        .webp()
        .toBuffer(),
    ),
  );
  await db.query(
    'UPDATE item_reports SET image_data=$1, image_data_2=$2, image_data_3=$3 WHERE report_id=1',
    photos,
  );
}

async function drill() {
  const source = connection(process.env.TEST_DATABASE_URL ?? '');
  const suffix = randomBytes(8).toString('hex');
  const schema = `drill_${suffix}`;
  const destinationName = `reunite_restore_${suffix}_test`;
  const destination = new URL(source);
  destination.pathname = `/${destinationName}`;
  const sourceConfig = databaseConfig({
    DATABASE_URL: source.href,
    DB_POOL_MAX: '1',
  });
  const admin = new Pool(sourceConfig);
  const sourceDb = new Pool({
    ...sourceConfig,
    options: `-c search_path=${schema}`,
  });
  const restored = new Pool({
    ...databaseConfig({ DATABASE_URL: destination.href, DB_POOL_MAX: '1' }),
    options: `-c search_path=${schema}`,
  });
  let createdSource = false;
  let createdDestination = false;
  let directory: string | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    createdSource = true;
    await admin.query(`CREATE DATABASE ${destinationName} TEMPLATE template0`);
    createdDestination = true;
    await migrate(sourceDb);
    await seed(sourceDb);
    directory = await mkdtemp(join(tmpdir(), 'reunite-restore-'));
    const archive = join(directory, 'test.dump');
    pgTool(
      'pg_dump',
      ['--schema', schema, '--format=custom', '--file', archive],
      source,
    );
    pgTool(
      'pg_restore',
      [
        '--dbname',
        destinationName,
        '--single-transaction',
        '--no-owner',
        '--no-privileges',
        archive,
      ],
      destination,
    );
    const [before, after, history] = await Promise.all([
      fingerprint(sourceDb),
      fingerprint(restored),
      migrationStatus(restored),
    ]);
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      !history.every(({ status }) => status === 'applied') ||
      after.reports !== 2 ||
      after.photos !== 3 ||
      after.claims !== 1 ||
      after.notifications !== 1 ||
      after.matches !== 1
    ) {
      throw new Error(
        'Restored data, fingerprints or migration history differ',
      );
    }
    return {
      reports: after.reports,
      photos: after.photos,
      claims: after.claims,
      notifications: after.notifications,
      matches: after.matches,
      migrations: history.length,
    };
  } finally {
    await Promise.all([sourceDb.end(), restored.end()]);
    try {
      try {
        if (createdDestination)
          await admin.query(`DROP DATABASE ${destinationName}`);
      } finally {
        if (createdSource) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      }
    } finally {
      await admin.end();
      if (directory) await rm(join(directory, 'test.dump'), { force: true });
      if (directory) await rmdir(directory);
    }
  }
}

try {
  console.info(JSON.stringify({ restored: await drill() }));
} catch {
  console.error(
    'Restore drill failed. Check the dedicated test database, local pg_dump / pg_restore versions and the test role’s CREATEDB permission.',
  );
  process.exitCode = 1;
}
