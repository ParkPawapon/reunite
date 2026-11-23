import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { migrate } from '../../packages/database/src/migrations';
import { hashPassword } from '@campus/database/password';
import { createServices } from '@/lib/composition';
import { createHandlers } from '@/lib/http/handlers';
import { serverConfig } from '@/config/server';
import { isolatedDatabase } from './database-fixture';

const fixture = isolatedDatabase();
const pool = fixture.pool;
const application = createServices(pool);
const handlers = createHandlers({
  services: () => application,
  ping: async () => {},
});
const origin = 'http://localhost:3000';
const identity = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  objectId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  email: 'assigned@kmutt.ac.th',
  name: 'Assigned campus member',
};
const password = 'disposable-test-password';

function request(
  path: string,
  method = 'GET',
  token?: string,
  credentials?: object,
) {
  const headers = new Headers({ origin, 'content-type': 'application/json' });
  if (token)
    headers.set('cookie', `${serverConfig().SESSION_COOKIE_NAME}=${token}`);
  return new Request(`${origin}/api/v1${path}`, {
    method,
    headers,
    body: JSON.stringify(credentials),
  });
}

beforeAll(async () => {
  vi.stubEnv('APP_BASE_URL', origin);
  vi.stubEnv('LOG_LEVEL', 'silent');
  await fixture.open();
  await migrate(pool);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await fixture.close();
});

it('creates one account under concurrent sign-in and uses the existing session lifecycle', async () => {
  expect((await handlers.me(request('/auth/me'))).status).toBe(401);
  const [first, concurrent] = await Promise.all([
    application.auth.loginWithMicrosoft(identity, 600),
    application.auth.loginWithMicrosoft(identity, 600),
  ]);
  expect(concurrent.profile).toEqual(first.profile);
  const { userId } = first.profile;
  expect(
    (
      await pool.query(
        'SELECT password_hash FROM users WHERE microsoft_tenant_id=$1 AND microsoft_object_id=$2',
        [identity.tenantId, identity.objectId],
      )
    ).rows,
  ).toEqual([{ password_hash: null }]);
  expect(
    (
      await handlers.login(
        request('/auth/login', 'POST', undefined, {
          email: identity.email,
          password,
        }),
      )
    ).status,
  ).toBe(401);

  const details = {
    firstName: 'Campus',
    lastName: 'Member',
    email: identity.email,
    studentId: null,
    faculty: null,
    department: null,
    major: null,
    phone: null,
  };
  await expect(
    application.profile.update(userId, details),
  ).resolves.toMatchObject({ name: 'Campus Member' });
  await expect(
    application.profile.update(userId, {
      ...details,
      email: 'other@kmutt.ac.th',
    }),
  ).rejects.toMatchObject({ status: 403 });
  const rotated = await application.auth.loginWithMicrosoft(
    { ...identity, email: 'renamed@kmutt.ac.th', name: 'Replacement' },
    600,
    first.token,
  );
  expect(rotated.profile).toEqual({
    userId,
    name: 'Campus Member',
    email: identity.email,
  });
  expect(
    (await handlers.me(request('/auth/me', 'GET', first.token))).status,
  ).toBe(401);
  const protectedResponse = await handlers.me(
    request('/auth/me', 'GET', rotated.token),
  );
  expect(protectedResponse.status).toBe(200);
  expect(await protectedResponse.json()).toEqual({ data: rotated.profile });
  expect(
    (await handlers.logout(request('/auth/logout', 'POST', rotated.token)))
      .status,
  ).toBe(200);
  expect(
    (await handlers.me(request('/auth/me', 'GET', rotated.token))).status,
  ).toBe(401);
});

it('preserves a password account through a collision and an explicit operator link', async () => {
  const legacy = {
    ...identity,
    objectId: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
    email: 'legacy@kmutt.ac.th',
  };
  const { rows } = await pool.query<{ user_id: number }>(
    'INSERT INTO users (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING user_id',
    ['Legacy member', legacy.email, await hashPassword(password), '0812345678'],
  );
  const userId = rows[0]?.user_id;
  if (userId === undefined) throw new Error('Missing password fixture');
  await expect(
    application.auth.loginWithMicrosoft(legacy, 600),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(
    (
      await pool.query(
        'SELECT microsoft_object_id FROM users WHERE user_id=$1',
        [userId],
      )
    ).rows,
  ).toEqual([{ microsoft_object_id: null }]);
  expect(
    (
      await handlers.login(
        request('/auth/login', 'POST', undefined, {
          email: legacy.email,
          password,
        }),
      )
    ).status,
  ).toBe(200);

  await pool.query(
    'UPDATE users SET microsoft_tenant_id=$2, microsoft_object_id=$3 WHERE user_id=$1',
    [userId, legacy.tenantId, legacy.objectId],
  );
  await expect(
    application.auth.loginWithMicrosoft(legacy, 600),
  ).resolves.toMatchObject({
    profile: { userId, name: 'Legacy member', email: legacy.email },
  });
  await expect(application.profile.get(userId)).resolves.toMatchObject({
    phone: '0812345678',
  });
  expect(
    (
      await handlers.login(
        request('/auth/login', 'POST', undefined, {
          email: legacy.email,
          password,
        }),
      )
    ).status,
  ).toBe(200);
});
