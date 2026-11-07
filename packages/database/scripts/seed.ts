import { randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { normalizeEmail } from '@campus/shared';
import { getPool, closePool } from '../src/pool';
import {
  assertLocalSeedTarget,
  seedDevelopmentAccount,
} from '../src/development-seed';

const accountSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.string().transform(normalizeEmail).pipe(z.email().max(255)),
  password: z.string().min(12).max(128),
});

try {
  // Reject unintended targets before creating a file or opening a connection.
  assertLocalSeedTarget(process.env, process.argv.slice(2));
  const root = realpathSync(
    fileURLToPath(new URL('../../../', import.meta.url)),
  );
  const directory = path.join(root, 'tmp', 'local-seed');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (
    !realpathSync(directory)
      .toLowerCase()
      .startsWith((root + path.sep).toLowerCase())
  )
    throw new Error(
      'Local seed credential directory must remain inside the repository',
    );
  const credentials = path.join(directory, 'login-account.json');
  if (!existsSync(credentials)) {
    try {
      writeFileSync(
        credentials,
        JSON.stringify(
          {
            name: 'ผู้ใช้ทดสอบ Reunite',
            email: 'demo@reunite.test',
            password: `Reunite-${randomBytes(18).toString('base64url')}`,
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'EEXIST'
      )
        throw error;
    }
  }
  if (
    lstatSync(credentials).isSymbolicLink() ||
    !lstatSync(credentials).isFile()
  )
    throw new Error('Local seed credentials must be a regular private file');
  const input = accountSchema.safeParse(
    JSON.parse(readFileSync(credentials, 'utf8')) as unknown,
  );
  if (!input.success)
    throw new Error('Local seed credential file has an invalid format');
  const result = await seedDevelopmentAccount(getPool(), input.data);
  console.info(
    `Local seed ${result.created ? 'created' : 'reused'} one account: ${input.data.email}`,
  );
  console.info(
    'Credentials: tmp/local-seed/login-account.json (ignored by Git and Docker; password not logged)',
  );
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith('Local seed')
      ? error.message
      : 'Local seed failed; check local database readiness, migrations and the private credential file',
  );
  process.exitCode = 1;
} finally {
  await closePool();
}
