import type { UserProfile } from '../../users/domain/user';

export type Credentials = { profile: UserProfile; passwordHash: string };
export interface AuthRepository {
  consumeLoginAttempt(keyHash: string): Promise<boolean>;
  findCredentials(email: string): Promise<Credentials | null>;
  createSession(hash: string, userId: number, expiresAt: Date): Promise<void>;
  findSession(hash: string): Promise<UserProfile | null>;
  revokeSession(hash: string): Promise<void>;
}
export interface AuthCryptography {
  verify(hash: string | undefined, password: string): Promise<boolean>;
  token(): string;
  digest(token: string): string;
}
