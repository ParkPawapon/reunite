import { getPool, closePool } from '../src/pool';
import { cleanupExpiredAuth } from '../src/auth-maintenance';

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply'))
    throw new Error('Usage: bun run db:cleanup-auth [--apply]');
  console.info(
    await cleanupExpiredAuth(getPool(), { apply: args.includes('--apply') }),
  );
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith('Usage:')
      ? error.message
      : 'Authentication cleanup failed; no credentials or identifiers are logged',
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
