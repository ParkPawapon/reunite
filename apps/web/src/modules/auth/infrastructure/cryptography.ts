import 'server-only';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '@campus/database/password';
import { createSessionToken, hashSessionToken } from '@/lib/security/session';
import type { AuthCryptography } from '../domain/auth';

let dummyHash: Promise<string> | undefined;
export const authCryptography: AuthCryptography = {
  token: createSessionToken,
  digest: hashSessionToken,
  async verify(hash, password) {
    if (hash) return verifyPassword(hash, password);
    dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
    await verifyPassword(await dummyHash, password);
    return false;
  },
};
