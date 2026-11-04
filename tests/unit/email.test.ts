import { expect, it } from 'vitest';
import { normalizeEmail } from '@campus/shared';
import { loginSchema } from '@/modules/auth/presentation/schemas';

it('uses the same canonical email for whitespace/case variants without touching passwords', () => {
  for (const email of [
    ' Tester@EXAMPLE.test ',
    '\tTESTER@example.test\n',
    '\u00a0Tester@example.test\u3000',
  ]) {
    expect(normalizeEmail(email)).toBe('tester@example.test');
    expect(loginSchema.parse({ email, password: ' password ' })).toEqual({
      email: 'tester@example.test',
      password: ' password ',
    });
  }
  expect(
    loginSchema.safeParse({ email: '   ', password: 'secret' }).success,
  ).toBe(false);
});
