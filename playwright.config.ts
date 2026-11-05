import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './tests/browser',
  globalTeardown: './tests/browser/global-teardown.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          'node --env-file-if-exists=.env.test --conditions=react-server --import tsx scripts/browser-test-server.ts',
        url: `${baseURL}/api/v1/health/live`,
        reuseExistingServer: false,
        timeout: 30_000,
      },
});
