import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

if (existsSync('.env.test')) process.loadEnvFile('.env.test');
const alias = {
  '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
  'server-only': fileURLToPath(
    new URL('./tests/server-only.ts', import.meta.url),
  ),
};
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'tests/unit/**/*.test.ts',
            'apps/web/src/**/__tests__/*.test.ts',
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
