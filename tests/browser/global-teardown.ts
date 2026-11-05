import { existsSync } from 'node:fs';
import { cleanupBrowserSchema } from './database-lifecycle';

export default async function teardown() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;
  if (existsSync('.env.test')) process.loadEnvFile('.env.test');
  await cleanupBrowserSchema();
}
