import { getPool, closePool } from '../src/pool';
import { migrationStatus } from '../src/migrations';

try {
  console.info(await migrationStatus(getPool()));
} catch {
  console.error(
    'Migration status failed; check database configuration or migration history',
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
