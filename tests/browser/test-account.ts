import type { APIRequestContext } from '@playwright/test';

// Only provisioned inside a disposable schema in the separate _test database.
export const browserAccount = {
  name: 'Browser acceptance fixture',
  email: 'browser-acceptance@example.test',
  password: 'Disposable browser fixture 2026!',
};

export const browserMapAccount = {
  ...browserAccount,
  name: 'Browser map fixture',
  email: 'browser-map@example.test',
};

export async function authenticateBrowserMapAccount(
  request: APIRequestContext,
) {
  const response = await request.post('/api/v1/auth/login', {
    headers: { origin: 'http://localhost:3100' },
    data: {
      email: browserMapAccount.email,
      password: browserMapAccount.password,
    },
  });
  if (!response.ok())
    throw new Error(`Test account login failed with HTTP ${response.status()}`);
}
