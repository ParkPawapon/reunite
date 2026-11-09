import { AppError, type Page } from '@campus/shared';
import type { Claim, ClaimRepository, ClaimInput } from '../domain/claim';

export class ClaimService {
  constructor(private readonly repository: ClaimRepository) {}
  // BE007: replace placeholder with owned claim listing from repository.
  async list(_userId: number, _page: Page): Promise<Claim[]> {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE007 is awaiting implementation',
    );
  }
  async find(id: number, userId: number): Promise<Claim> {
    const claim = await this.repository.findOwned(id, userId);
    if (!claim) throw new AppError('NOT_FOUND', 404, 'Claim not found');
    return claim;
  }
  // FK existence is enforced atomically by PostgreSQL. Further eligibility rules are undecided.
  create(userId: number, input: ClaimInput) {
    return this.repository.create(userId, input);
  }
}
