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
  // BE008: replace placeholder with owned claim lookup and non-disclosing 404 NOT_FOUND check.
  async find(_id: number, _userId: number): Promise<Claim> {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE008 is awaiting implementation',
    );
  }
  // FK existence is enforced atomically by PostgreSQL. Further eligibility rules are undecided.
  create(userId: number, input: ClaimInput) {
    return this.repository.create(userId, input);
  }
}
