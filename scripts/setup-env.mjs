import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Preserve any existing configuration; derive both files from the same root values.
if (!existsSync('.env')) {
  writeFileSync(
    '.env',
    readFileSync('.env.example', 'utf8').replaceAll(
      'CHANGE_ME',
      randomBytes(24).toString('hex'),
    ),
    { flag: 'wx' },
  );
}
if (!existsSync('apps/web/.env.local'))
  writeFileSync('apps/web/.env.local', readFileSync('.env', 'utf8'), {
    flag: 'wx',
  });
process.stdout.write(
  'Local environment files ready; existing files preserved.\n',
);
