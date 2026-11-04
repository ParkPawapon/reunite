import { z } from 'zod';
import { getPool, closePool } from '../src/pool';
import { hashPassword } from '../src/password';
import { normalizeEmail } from '@campus/shared';

try {
  if (
    process.env.NODE_ENV === 'production' ||
    !process.argv.includes('--development-only')
  )
    throw new Error(
      'Development provisioning requires --development-only and a non-production NODE_ENV',
    );
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
  console.info('Development user created');
} catch (error) {
  console.error(
    error instanceof Error &&
      (error.message.startsWith('Set PROVISION') ||
        error.message.startsWith('Development provisioning'))
      ? error.message
      : 'User provisioning failed; check database connection and duplicate email',
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
