import 'server-only';
import { hash, verify, argon2id } from 'argon2';

export const passwordOptions = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;
export const hashPassword = (password: string) =>
  hash(password, passwordOptions);
export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
