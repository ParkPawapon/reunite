import { cpSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const web = path.resolve('apps/web');
const standalone = path.join(web, '.next/standalone/apps/web');
if (!existsSync(path.join(standalone, 'server.js')))
  throw new Error('Run bun run build before bun run start');
cpSync(path.join(web, '.next/static'), path.join(standalone, '.next/static'), {
  recursive: true,
});
cpSync(path.join(web, 'public'), path.join(standalone, 'public'), {
  recursive: true,
});
const child = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: process.env.HOSTNAME ?? '127.0.0.1' },
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
