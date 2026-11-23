import { AppError } from '@campus/shared';
import type {
  AuthRepository,
  AuthCryptography,
  MicrosoftIdentity,
} from '../domain/auth';
import type { UserProfile } from '../../users/domain/user';

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
    return this.startSession(credentials.profile, ttlSeconds);
  }
  async loginWithMicrosoft(
    identity: MicrosoftIdentity,
    ttlSeconds: number,
    previousToken?: string,
  ) {
    const user = await this.repository.findOrCreateMicrosoftUser(identity);
    if (!user)
      throw new AppError(
        'CONFLICT',
        409,
        'Microsoft identity requires a verified account link',
      );
    return {
      ...(await this.startSession(user.profile, ttlSeconds, previousToken)),
      profileCompletionRequired: user.profileCompletionRequired,
    };
  }
  private async startSession(
    profile: UserProfile,
    ttlSeconds: number,
    previousToken?: string,
  ) {
    const token = this.cryptography.token();
    await this.repository.createSession(
      this.cryptography.digest(token),
      profile.userId,
      new Date(Date.now() + ttlSeconds * 1000),
      previousToken ? this.cryptography.digest(previousToken) : undefined,
    );
    return { profile, token };
  }
  async requireUser(token: string | undefined) {
    const session = await this.requireSession(token);
    if (session.profileCompletionRequired)
      throw new AppError(
        'PROFILE_COMPLETION_REQUIRED',
        403,
        'Complete your profile to continue',
      );
    return session.profile;
  }
  async requireSession(token: string | undefined) {
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
