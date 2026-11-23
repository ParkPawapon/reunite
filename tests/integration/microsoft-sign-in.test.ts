import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  migrate,
  readMigrations,
} from '../../packages/database/src/migrations';
import { hashPassword } from '@campus/database/password';
import { createServices } from '@/lib/composition';
import { createHandlers } from '@/lib/http/handlers';
import { createAccountHandlers } from '@/lib/http/account-handlers';
import { createMatchingHandlers } from '@/lib/http/matching-handlers';
import { serverConfig } from '@/config/server';
import { isolatedDatabase } from './database-fixture';

const fixture = isolatedDatabase();
const pool = fixture.pool;
const application = createServices(pool);
const handlers = createHandlers({
  services: () => application,
  ping: async () => {},
});
const account = createAccountHandlers(() => application);
const matching = createMatchingHandlers(() => application);
const origin = 'http://localhost:3000';
const identity = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  objectId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  email: 'assigned@kmutt.ac.th',
  name: 'Assigned campus member',
};
const password = 'disposable-test-password';
const existing = {
  ...identity,
  objectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  email: 'completed@kmutt.ac.th',
};

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
  const migrations = await readMigrations();
  await migrate(
    pool,
    migrations.filter(({ version }) => version < '0013'),
  );
  await pool.query(
    `INSERT INTO users (name, email, microsoft_tenant_id, microsoft_object_id, first_name, last_name, student_id)
    VALUES ('Existing Member', $1, $2, $3, 'Existing', 'Member', '0000000123')`,
    [existing.email, existing.tenantId, existing.objectId],
  );
  await migrate(pool, migrations);
});

it('preserves prior profile completion and the saved student ID', async () => {
  const user = await application.auth.loginWithMicrosoft(existing, 600);
  expect(user.profileCompletionRequired).toBe(false);
  expect(await application.profile.get(user.profile.userId)).toMatchObject({
    firstName: 'Existing',
    lastName: 'Member',
    studentId: '0000000123',
  });
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
  expect(first.profileCompletionRequired).toBe(true);
  expect(concurrent.profileCompletionRequired).toBe(true);
  const { userId } = first.profile;
  const profileDraft = {
    firstName: 'Campus',
    lastName: 'Member',
  };
  await application.auth.loginWithMicrosoft({ ...identity, profileDraft }, 600);
  expect(await application.profile.get(userId)).toMatchObject({
    ...profileDraft,
    studentId: null,
  });
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
    studentId: '0123456789',
    faculty: 'Engineering',
    department: 'Computer Engineering',
    major: 'Software Engineering',
    phone: null,
  };
  const completion = {
    studentId: details.studentId,
    faculty: details.faculty,
    department: details.department,
    major: details.major,
  };
  const endpoint = '/profile/complete';
  expect(
    (
      await account.completeProfile(
        request(endpoint, 'POST', undefined, completion),
      )
    ).status,
  ).toBe(401);
  expect(
    (await handlers.me(request('/auth/me', 'GET', first.token))).status,
  ).toBe(200);
  for (const handler of [
    handlers.listReports,
    handlers.categories,
    handlers.locations,
    account.profile,
    account.notifications,
    matching.list,
  ]) {
    const blocked = await handler(request('/resource', 'GET', first.token));
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({
      error: { code: 'PROFILE_COMPLETION_REQUIRED' },
    });
  }
  expect(
    (
      await account.updateProfile(
        request('/profile', 'PATCH', first.token, details),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await account.completeProfile(
        request(endpoint, 'POST', first.token, {
          ...completion,
          userId: userId + 1,
        }),
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await account.completeProfile(
        request(endpoint, 'POST', first.token, {
          ...completion,
          studentId: 'invalid',
        }),
      )
    ).status,
  ).toBe(422);
  const foreign = request(endpoint, 'POST', first.token, completion);
  foreign.headers.set('origin', 'https://example.org');
  expect((await account.completeProfile(foreign)).status).toBe(403);
  const completed = await Promise.all([
    account.completeProfile(request(endpoint, 'POST', first.token, completion)),
    account.completeProfile(
      request(endpoint, 'POST', concurrent.token, completion),
    ),
  ]);
  expect(completed.map((response) => response.status)).toEqual([200, 200]);
  expect(
    (
      await account.completeProfile(
        request(endpoint, 'POST', first.token, {
          ...completion,
          major: 'Replacement',
        }),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await pool.query('SELECT kind FROM notifications WHERE user_id=$1', [
        userId,
      ])
    ).rows,
  ).toEqual([{ kind: 'PROFILE_UPDATED' }]);
  expect(
    (await handlers.listReports(request('/item-reports', 'GET', first.token)))
      .status,
  ).toBe(200);
  expect(
    (await account.profile(request('/profile', 'GET', first.token))).status,
  ).toBe(200);
  await expect(
    application.profile.update(userId, {
      ...details,
      email: 'other@kmutt.ac.th',
    }),
  ).rejects.toMatchObject({ status: 403 });
  const rotated = await application.auth.loginWithMicrosoft(
    {
      ...identity,
      email: 'renamed@kmutt.ac.th',
      name: 'Replacement',
      profileDraft,
    },
    600,
    first.token,
  );
  expect(rotated.profileCompletionRequired).toBe(false);
  expect(await application.profile.get(userId)).toMatchObject({
    ...completion,
    ...profileDraft,
  });
  expect(
    (
      await pool.query(
        'SELECT microsoft_student_id_draft FROM users WHERE user_id=$1',
        [userId],
      )
    ).rows,
  ).toEqual([{ microsoft_student_id_draft: null }]);
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
  const linked = await application.auth.loginWithMicrosoft(legacy, 600);
  expect(linked).toMatchObject({
    profile: { userId, name: 'Legacy member', email: legacy.email },
    profileCompletionRequired: true,
  });
  await expect(application.profile.get(userId)).resolves.toMatchObject({
    phone: '0812345678',
  });
  expect(
    (
      await account.completeProfile(
        request('/profile/complete', 'POST', linked.token, {}),
      )
    ).status,
  ).toBe(200);
  await expect(
    application.auth.requireUser(linked.token),
  ).resolves.toMatchObject({ userId, name: 'Legacy member' });
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
