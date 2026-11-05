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
  await database.pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
    [
      browserAccount.name,
      browserAccount.email,
      await hashPassword(browserAccount.password),
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
