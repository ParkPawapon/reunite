import { databaseConfig } from '../packages/database/src/config';
import { serverConfig } from '../apps/web/src/config/server';

try {
  databaseConfig();
  serverConfig();
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
