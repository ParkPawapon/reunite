import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  hashSessionToken,
  readSessionToken,
  sessionCookie,
} from '@/lib/security/session';
import { assertSameOrigin } from '@/lib/security/origin';
import { hashPassword, verifyPassword } from '@campus/database/password';

describe('security primitives', () => {
  it('creates unique opaque tokens and stores digests', () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(createSessionToken()).not.toBe(token);
    expect(hashSessionToken(token)).toHaveLength(64);
    expect(hashSessionToken(token)).not.toContain(token);
  });
  it('uses scoped HttpOnly SameSite cookies and production Secure', () => {
    expect(sessionCookie('session', 'token', 60, true)).toBe(
      'session=token; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure',
    );
    expect(sessionCookie('session', '', 0, false)).toContain('Max-Age=0');
  });
  it('rejects malformed and duplicate cookies', () => {
    const token = createSessionToken();
    const req = (cookie: string) =>
      new Request('http://localhost', { headers: { cookie } });
    expect(
      readSessionToken(req(`other=123; session=${token}`), 'session'),
    ).toBe(token);
    expect(readSessionToken(req('session=bad'), 'session')).toBeUndefined();
    expect(
      readSessionToken(req(`session=${token}; session=${token}`), 'session'),
    ).toBeUndefined();
  });
  it('requires exact trusted Origin for every mutation', () => {
    for (const origin of [
      '',
      'null',
      'https://evil.test',
      'https://app.test.evil.test',
    ])
      expect(() =>
        assertSameOrigin(
          new Request('https://app.test/api', {
            headers: origin ? { origin } : {},
          }),
          'https://app.test',
        ),
      ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Request('https://app.test/api', {
          headers: { origin: 'https://app.test' },
        }),
        'https://app.test',
      ),
    ).not.toThrow();
  });
  it('hashes with Argon2id and safely rejects invalid hashes', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(
      true,
    );
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
    expect(await verifyPassword('invalid', 'anything')).toBe(false);
  });
});
