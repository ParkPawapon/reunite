import { databaseConfig } from '../packages/database/src/config';
import { serverConfig } from '../apps/web/src/config/server';
import { matchingConfig } from '../apps/web/src/config/matching';
import { microsoftConfig } from '../apps/web/src/config/microsoft';

try {
  databaseConfig();
  serverConfig();
  matchingConfig();
  microsoftConfig();
  process.stdout.write(
    'Database and server environment valid (no connection attempted)\n',
  );
} catch (error) {
  // Validators produce fixed messages or field names, never supplied values.
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Invalid environment'}\n`,
  );
  process.exitCode = 1;
}
