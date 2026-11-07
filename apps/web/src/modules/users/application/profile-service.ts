import { AppError } from '@campus/shared';
import type { ProfileInput, ProfileRepository } from '../domain/profile';

export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly confirmPassword: (
      userId: number,
      hash: string,
      password: string,
    ) => Promise<boolean>,
  ) {}
  async get(userId: number) {
    const profile = await this.repository.get(userId);
    if (!profile) throw new AppError('NOT_FOUND', 404, 'Account unavailable');
    return profile;
  }
  async update(userId: number, input: ProfileInput) {
    const credentials = await this.repository.credentials(userId);
    if (!credentials)
      throw new AppError('NOT_FOUND', 404, 'Account unavailable');
    if (input.email !== credentials.email) {
      if (
        !input.currentPassword ||
        !(await this.confirmPassword(
          userId,
          credentials.hash,
          input.currentPassword,
        ))
      )
        throw new AppError(
          'PASSWORD_REQUIRED',
          422,
          'Confirm your current password to change email',
        );
    }
    const result = await this.repository.update(
      userId,
      input,
      credentials.hash,
    );
    if (!result)
      throw new AppError('CONFLICT', 409, 'Account changed; reload and retry');
    return result;
  }
  async setAvatar(
    userId: number,
    data: Uint8Array | null,
    version: string | null,
  ) {
    await this.repository.setAvatar(userId, data, version);
    return this.get(userId);
  }
  async avatar(userId: number) {
    const data = await this.repository.avatar(userId);
    if (!data) throw new AppError('NOT_FOUND', 404, 'No profile image');
    return data;
  }
}
