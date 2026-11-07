import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import {
  migrate,
  readMigrations,
} from '../../packages/database/src/migrations';
import { hashPassword } from '@campus/database/password';
import { createServices } from '@/lib/composition';
import { createAccountHandlers } from '@/lib/http/account-handlers';
import { hashSessionToken } from '@/lib/security/session';
import { serverConfig } from '@/config/server';
import { isolatedDatabase } from './database-fixture';

const fixture = isolatedDatabase();
const pool = fixture.pool;
const handlers = createAccountHandlers(() => createServices(pool));
const origin = 'http://localhost:3000';
const password = randomBytes(18).toString('base64url');
let userId: number;
let otherId: number;
let cookie: string;
let otherCookie: string;
const input = {
  firstName: 'ทดสอบ',
  lastName: 'โปรไฟล์',
  email: 'profile@example.test',
  studentId: '1234567890123',
  faculty: 'คณะทดสอบ',
  department: 'ภาควิชาทดสอบ',
  major: 'สาขาทดสอบ',
  phone: '0812345678',
};
function request(
  path: string,
  method = 'GET',
  body?: unknown,
  session = cookie,
  requestOrigin = origin,
) {
  return new Request(`${origin}/api/v1/${path}`, {
    method,
    headers: {
      origin: requestOrigin,
      cookie: session,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function data(response: Response) {
  return (await response.json()).data;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.APP_BASE_URL = origin;
  process.env.LOG_LEVEL = 'silent';
  await fixture.open();
  await migrate(pool, (await readMigrations()).slice(0, 4));
  const hash = await hashPassword(password);
  for (const [name, email] of [
    ['Legacy display name', input.email],
    ['Other account', 'other-profile@example.test'],
  ]) {
    const row = (
      await pool.query<{ user_id: number }>(
        'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING user_id',
        [name, email, hash],
      )
    ).rows[0];
    if (!row) throw new Error('Missing fixture');
    const token = randomBytes(32).toString('base64url');
    await pool.query(
      "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP + INTERVAL '1 day')",
      [hashSessionToken(token), row.user_id],
    );
    const value = `${serverConfig().SESSION_COOKIE_NAME}=${token}`;
    if (email === input.email) {
      userId = row.user_id;
      cookie = value;
    } else {
      otherId = row.user_id;
      otherCookie = value;
    }
  }
});
afterAll(() => fixture.close());

describe('student profile and private notification workflow', () => {
  it('upgrades legacy accounts without inventing personal data or losing active sessions', async () => {
    expect(await migrate(pool)).toEqual(['0005', '0006']);
    expect(
      await data(await handlers.profile(request('profile'))),
    ).toMatchObject({
      name: 'Legacy display name',
      firstName: null,
      lastName: null,
      studentId: null,
      phone: null,
      avatarVersion: null,
    });
    const tables = await pool.query(
      'SELECT tablename FROM pg_tables WHERE schemaname=$1',
      [fixture.schema],
    );
    expect(tables.rowCount).toBe(9);
    expect(
      (await pool.query('SELECT token_hash FROM auth_sessions')).rowCount,
    ).toBe(2);
  });
  it('requires authentication, same-origin mutations and rejects unowned identity fields', async () => {
    expect(
      (await handlers.profile(request('profile', 'GET', undefined, ''))).status,
    ).toBe(401);
    expect(
      (
        await handlers.notifications(
          request('notifications', 'GET', undefined, ''),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handlers.updateProfile(
          request(
            'profile',
            'PATCH',
            input,
            cookie,
            'https://attacker.example',
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handlers.updateProfile(
          request('profile', 'PATCH', { ...input, userId: otherId }),
        )
      ).status,
    ).toBe(422);
  });
  it('saves all profile fields and creates one atomic, private notification only for a real change', async () => {
    const response = await handlers.updateProfile(
      request('profile', 'PATCH', input),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await data(response)).toMatchObject({
      ...input,
      name: 'ทดสอบ โปรไฟล์',
    });
    expect(
      (
        await data(
          await handlers.profile(
            request('profile', 'GET', undefined, otherCookie),
          ),
        )
      ).firstName,
    ).toBeNull();
    await handlers.updateProfile(request('profile', 'PATCH', input));
    const notifications = await data(
      await handlers.notifications(request('notifications')),
    );
    expect(notifications.items).toHaveLength(1);
    expect(notifications.unreadCount).toBe(1);
    expect(
      (
        await data(
          await handlers.notifications(
            request('notifications', 'GET', undefined, otherCookie),
          ),
        )
      ).items,
    ).toEqual([]);
    const raw = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1',
      [userId],
    );
    expect(Object.keys(raw.rows[0])).toEqual([
      'notification_id',
      'user_id',
      'kind',
      'created_at',
      'read_at',
    ]);
  });
  it('enforces uniqueness without partial updates and requires a throttled password check for email changes', async () => {
    const duplicate = await handlers.updateProfile(
      request('profile', 'PATCH', {
        ...input,
        email: 'other-profile@example.test',
        currentPassword: password,
      }),
    );
    expect(duplicate.status).toBe(409);
    expect((await data(await handlers.profile(request('profile')))).email).toBe(
      input.email,
    );
    expect(
      (
        await handlers.updateProfile(
          request('profile', 'PATCH', {
            ...input,
            email: 'changed@example.test',
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await handlers.updateProfile(
          request('profile', 'PATCH', {
            ...input,
            email: 'changed@example.test',
            currentPassword: 'incorrect',
          }),
        )
      ).status,
    ).toBe(422);
    const changed = await handlers.updateProfile(
      request('profile', 'PATCH', {
        ...input,
        email: ' CHANGED@EXAMPLE.test ',
        currentPassword: password,
      }),
    );
    expect(changed.status).toBe(200);
    expect((await data(changed)).email).toBe('changed@example.test');
    const copy = await handlers.updateProfile(
      request(
        'profile',
        'PATCH',
        { ...input, email: 'other-profile@example.test' },
        otherCookie,
      ),
    );
    expect(copy.status).toBe(409);
  });
  it('streams bounded uploads, strips metadata and serves the image only to its account', async () => {
    const png = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#FFC72C' },
    })
      .png()
      .withMetadata()
      .toBuffer();
    const upload = (bytes: Uint8Array, type: string, session = cookie) =>
      new Request(`${origin}/api/v1/profile/avatar`, {
        method: 'PUT',
        headers: { origin, cookie: session, 'content-type': type },
        body: new Uint8Array(bytes),
      });
    expect(
      (await handlers.uploadAvatar(upload(png, 'image/png', ''))).status,
    ).toBe(401);
    expect(
      (
        await handlers.uploadAvatar(
          upload(Buffer.from('<svg/>'), 'image/svg+xml'),
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await handlers.uploadAvatar(
          upload(new Uint8Array(2 * 1024 * 1024 + 1), 'image/png'),
        )
      ).status,
    ).toBe(413);
    expect(
      (await handlers.uploadAvatar(upload(png, 'image/jpeg'))).status,
    ).toBe(422);
    const saved = await handlers.uploadAvatar(upload(png, 'image/png'));
    expect(saved.status).toBe(200);
    expect((await data(saved)).avatarVersion).toMatch(/^[0-9a-f]{64}$/);
    const response = await handlers.avatar(request('profile/avatar'));
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const meta = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    expect(meta).toMatchObject({ width: 384, height: 384, format: 'webp' });
    expect(meta.exif).toBeUndefined();
    expect(
      (
        await handlers.avatar(
          request('profile/avatar', 'GET', undefined, otherCookie),
        )
      ).status,
    ).toBe(404);
    expect(
      (await handlers.avatar(request('profile/avatar', 'GET', undefined, '')))
        .status,
    ).toBe(401);
    expect(
      (await handlers.deleteAvatar(request('profile/avatar', 'DELETE'))).status,
    ).toBe(200);
    expect((await handlers.avatar(request('profile/avatar'))).status).toBe(404);
  });
  it('paginates without duplicates and marks only owned notifications through a fetched boundary', async () => {
    await pool.query(
      "INSERT INTO notifications(user_id,kind) SELECT $1,'PROFILE_UPDATED' FROM generate_series(1,25)",
      [userId],
    );
    await pool.query(
      "INSERT INTO notifications(user_id,kind) VALUES($1,'PROFILE_UPDATED')",
      [otherId],
    );
    const first = await data(
      await handlers.notifications(request('notifications')),
    );
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBeGreaterThan(0);
    const next = await data(
      await handlers.notifications(
        request(`notifications?before=${first.nextCursor}`),
      ),
    );
    expect(
      new Set(
        [...first.items, ...next.items].map((item) => item.notificationId),
      ).size,
    ).toBe(first.items.length + next.items.length);
    const boundary = first.items[0].notificationId;
    await pool.query(
      "INSERT INTO notifications(user_id,kind) VALUES($1,'PROFILE_UPDATED')",
      [userId],
    );
    expect(
      (
        await handlers.readNotifications(
          request('notifications', 'PATCH', { throughId: boundary }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await data(await handlers.notifications(request('notifications'))))
        .unreadCount,
    ).toBe(1);
    expect(
      (
        await data(
          await handlers.notifications(
            request('notifications', 'GET', undefined, otherCookie),
          ),
        )
      ).unreadCount,
    ).toBe(1);
    expect(
      (await handlers.notifications(request('notifications?before=-1'))).status,
    ).toBe(422);
    expect(
      (await handlers.notifications(request('notifications?before=1&before=2')))
        .status,
    ).toBe(422);
    expect(
      (
        await handlers.readNotifications(
          request(
            'notifications',
            'PATCH',
            { throughId: boundary },
            cookie,
            'https://attacker.example',
          ),
        )
      ).status,
    ).toBe(403);
  });
  it('enforces database constraints on identifiers and paired avatar bytes', async () => {
    await expect(
      pool.query('UPDATE users SET student_id=$1 WHERE user_id=$2', [
        'abc',
        userId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query('UPDATE users SET avatar_version=$1 WHERE user_id=$2', [
        'a'.repeat(64),
        userId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query('UPDATE users SET first_name=$1 WHERE user_id=$2', [
        '   ',
        userId,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
