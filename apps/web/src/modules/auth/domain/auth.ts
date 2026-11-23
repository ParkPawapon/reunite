import type { UserProfile } from '../../users/domain/user';

export type Credentials = { profile: UserProfile; passwordHash: string };
export type SessionUser = {
  profile: UserProfile;
  profileCompletionRequired: boolean;
};
export type MicrosoftIdentity = {
  tenantId: string;
  objectId: string;
  email: string;
  name: string;
};
export interface AuthRepository {
  consumeLoginAttempt(keyHash: string): Promise<boolean>;
  findCredentials(email: string): Promise<Credentials | null>;
  findOrCreateMicrosoftUser(
    identity: MicrosoftIdentity,
  ): Promise<SessionUser | null>;
  createSession(
    hash: string,
    userId: number,
    expiresAt: Date,
    previousHash?: string,
  ): Promise<void>;
  findSession(hash: string): Promise<SessionUser | null>;
  revokeSession(hash: string): Promise<void>;
}
export interface AuthCryptography {
  verify(hash: string | undefined, password: string): Promise<boolean>;
  token(): string;
  digest(token: string): string;
}
