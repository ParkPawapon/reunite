import { spawn } from 'node:child_process';
import { isolatedDatabase } from '../tests/integration/database-fixture';
import { migrate } from '../packages/database/src/migrations';
import { hashPassword } from '../packages/database/src/password';
import { browserAccount } from '../tests/browser/test-account';
import {
  cleanupBrowserSchema,
  registerBrowserSchema,
} from '../tests/browser/database-lifecycle';

// Never provision browser fixtures in the application's normal database.
const database = isolatedDatabase();
let child: ReturnType<typeof spawn> | undefined;
let closing = false;
async function close(code: number) {
  if (closing) return;
  closing = true;
  try {
    await database.close();
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === '3F000'))
      throw error;
  } finally {
    process.exitCode = code;
  }
}
try {
  await cleanupBrowserSchema();
  registerBrowserSchema(database.schema);
  await database.open();
  await migrate(database.pool);
  const account = await database.pool.query<{ user_id: number }>(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
    [
      browserAccount.name,
      browserAccount.email,
      await hashPassword(browserAccount.password),
    ],
  );
  const category = await database.pool.query<{ category_id: number }>(
    'INSERT INTO categories(category_name) VALUES($1) RETURNING category_id',
    ['หมวดหมู่ทดสอบ'],
  );
  const location = await database.pool.query<{ location_id: number }>(
    'INSERT INTO locations(location_name) VALUES($1) RETURNING location_id',
    ['สถานที่ทดสอบ'],
  );
  await database.pool.query(
    `INSERT INTO item_reports(user_id, category_id, location_id, type, title, description, event_datetime, status)
     SELECT $1, $2, $3, CASE WHEN n <= 12 THEN 'LOST' ELSE 'FOUND' END,
       CASE WHEN n <= 12 THEN 'ของหายทดสอบ ' || n ELSE 'ของที่พบทดสอบ ' || (n - 12) END,
       $4, $5::timestamptz + n * interval '1 hour',
       CASE WHEN n = 11 THEN 'RESOLVED' WHEN n = 10 THEN 'CLOSED' ELSE 'OPEN' END
     FROM generate_series(1,14) AS n`,
    [
      account.rows[0]?.user_id,
      category.rows[0]?.category_id,
      location.rows[0]?.location_id,
      'รายละเอียดสำหรับทดสอบตาราง',
      '2026-11-12T03:00:00Z',
    ],
  );
  const target = new URL(process.env.TEST_DATABASE_URL ?? '');
  target.searchParams.set('options', `-c search_path=${database.schema}`);
  child = spawn(process.execPath, ['scripts/start.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      APP_BASE_URL: 'http://localhost:3100',
      DATABASE_URL: target.toString(),
      SESSION_COOKIE_NAME: 'browser_test_session',
      LOG_LEVEL: 'silent',
      MATCHING_ENABLED: 'false',
      MATCHING_BUDGET_USD: '0',
      OPENAI_API_KEY: '',
      HOSTNAME: '127.0.0.1',
      PORT: '3100',
    },
  });
  child.on('error', () => {
    void close(1);
  });
  child.on('exit', (code) => {
    void close(closing ? 0 : (code ?? 1));
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      child?.kill(signal);
    });
} catch {
  process.stderr.write(
    'Browser test setup failed; verify the separate TEST_DATABASE_URL and production build.\n',
  );
  await close(1);
}
