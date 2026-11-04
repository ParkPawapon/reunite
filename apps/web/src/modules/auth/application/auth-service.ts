import { AppError } from '@campus/shared';
import type { AuthRepository, AuthCryptography } from '../domain/auth';

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly cryptography: AuthCryptography,
  ) {}
  async login(email: string, password: string, ttlSeconds: number) {
    if (
      !(await this.repository.consumeLoginAttempt(
        this.cryptography.digest(email),
      ))
    )
      throw new AppError(
        'RATE_LIMITED',
        429,
        'Too many login attempts; retry after 15 minutes',
      );
    const credentials = await this.repository.findCredentials(email);
    const valid = await this.cryptography.verify(
      credentials?.passwordHash,
      password,
    );
    if (!credentials || !valid)
      throw new AppError(
        'INVALID_CREDENTIALS',
        401,
        'Invalid email or password',
      );
    const token = this.cryptography.token();
    await this.repository.createSession(
      this.cryptography.digest(token),
      credentials.profile.userId,
      new Date(Date.now() + ttlSeconds * 1000),
    );
    return { profile: credentials.profile, token };
  }
  async requireUser(token: string | undefined) {
    if (!token)
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const user = await this.repository.findSession(
      this.cryptography.digest(token),
    );
    if (!user)
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    return user;
  }
  async logout(token: string | undefined) {
    if (token)
      await this.repository.revokeSession(this.cryptography.digest(token));
  }
}
