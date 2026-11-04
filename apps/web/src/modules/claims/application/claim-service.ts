import { AppError, type Page } from '@campus/shared';
import type { ClaimRepository, ClaimInput } from '../domain/claim';

export class ClaimService {
  constructor(private readonly repository: ClaimRepository) {}
  list(userId: number, page: Page) {
    return this.repository.listOwned(userId, page);
  }
  async find(id: number, userId: number) {
    const claim = await this.repository.findOwned(id, userId);
    if (!claim) throw new AppError('NOT_FOUND', 404, 'Claim not found');
    return claim;
  }
  // FK existence is enforced atomically by PostgreSQL. Further eligibility rules are undecided.
  create(userId: number, input: ClaimInput) {
    return this.repository.create(userId, input);
  }
}
