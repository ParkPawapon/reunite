import 'server-only';
import { normalizeEmail } from '@campus/shared';
import { hashPassword, verifyPassword } from './password';
import { query, type Sql } from './query';

export type DevelopmentAccount = {
  name: string;
  email: string;
  password: string;
};

export function assertLocalSeedTarget(env: NodeJS.ProcessEnv, args: string[]) {
  if (
    !args.includes('--development-only') ||
    (env.NODE_ENV !== undefined &&
      !['development', 'test'].includes(env.NODE_ENV))
  )
    throw new Error(
      'Local seed requires --development-only and a non-production environment',
    );
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  let database: URL;
  let application: URL;
  try {
    database = new URL(env.DATABASE_URL ?? '');
    application = new URL(env.APP_BASE_URL ?? '');
  } catch {
    throw new Error(
      'Local seed requires valid local DATABASE_URL and APP_BASE_URL',
    );
  }
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !localHosts.has(database.hostname) ||
    database.search ||
    !['http:', 'https:'].includes(application.protocol) ||
    !localHosts.has(application.hostname)
  )
    throw new Error(
      'Local seed only accepts loopback targets without database URL query overrides',
    );
}

// Intentionally private to development tooling, not exported by the runtime package.
export async function seedDevelopmentAccount(
  db: Sql,
  account: DevelopmentAccount,
) {
  const email = normalizeEmail(account.email);
  const [created] = await query<{ user_id: number }>(
    db,
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING user_id`,
    [account.name, email, await hashPassword(account.password)],
  );
  if (created) return { userId: created.user_id, created: true };
  const [existing] = await query<{ user_id: number; password_hash: string }>(
    db,
    'SELECT user_id, password_hash FROM users WHERE email = $1',
    [email],
  );
  if (
    !existing ||
    !(await verifyPassword(existing.password_hash, account.password))
  )
    throw new Error(
      'Local seed account already exists with different credentials; its data was preserved',
    );
  return { userId: existing.user_id, created: false };
}
