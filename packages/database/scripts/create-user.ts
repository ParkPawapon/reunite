import { z } from 'zod';
import { getPool, closePool } from '../src/pool';
import { hashPassword } from '../src/password';
import { normalizeEmail } from '@campus/shared';

try {
  const flags = process.argv.slice(2);
  const production = flags.length === 1 && flags[0] === '--production';
  if (
    !production &&
    (process.env.NODE_ENV === 'production' ||
      flags.length !== 1 ||
      flags[0] !== '--development-only')
  )
    throw new Error(
      'Development provisioning requires --development-only as the only flag and a non-production NODE_ENV. Use --production for a production account.',
    );
  if (production) {
    const origin = URL.parse(process.env.APP_BASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'production' ||
      process.env.DB_SSL !== 'verify-full' ||
      origin?.protocol !== 'https:' ||
      origin.href !== `${origin.origin}/`
    )
      throw new Error(
        'User provisioning in production requires NODE_ENV=production, DB_SSL=verify-full and an HTTPS APP_BASE_URL origin',
      );
  }
  const input = z
    .object({
      PROVISION_NAME: z.string().trim().min(1).max(100),
      PROVISION_EMAIL: z
        .string()
        .transform(normalizeEmail)
        .pipe(z.email().max(255)),
      PROVISION_PASSWORD: z.string().min(12).max(128),
    })
    .safeParse(process.env);
  if (!input.success)
    throw new Error(
      'Set PROVISION_NAME, PROVISION_EMAIL and PROVISION_PASSWORD (12-128 characters) in your shell',
    );
  const {
    PROVISION_NAME: name,
    PROVISION_EMAIL: email,
    PROVISION_PASSWORD: password,
  } = input.data;
  await getPool().query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
    [name, email, await hashPassword(password)],
  );
  console.info(
    production ? 'Production user created' : 'Development user created',
  );
} catch (error) {
  console.error(
    error instanceof Error &&
      (error.message.startsWith('Set PROVISION') ||
        error.message.startsWith('Development provisioning') ||
        error.message.startsWith('User provisioning'))
      ? error.message
      : 'User provisioning failed; check database connection and duplicate email',
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
