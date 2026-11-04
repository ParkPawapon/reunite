import { getPool, closePool } from '../src/pool';
import { migrate } from '../src/migrations';

try {
  console.info({ applied: await migrate(getPool()) });
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith('Migration')
      ? error.message
      : 'Migration failed; check database connectivity and configuration',
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
