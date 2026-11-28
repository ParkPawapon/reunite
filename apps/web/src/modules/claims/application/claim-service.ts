import { AppError, type Page } from '@campus/shared';
import type {
  Claim,
  ClaimBrowse,
  ClaimRepository,
  ClaimInput,
  ClaimStatusDecision,
} from '../domain/claim';

export class ClaimService {
  constructor(private readonly repository: ClaimRepository) {}
  list(userId: number, page: ClaimBrowse): Promise<Claim[]> {
    return this.repository.listOwned(userId, page);
  }
  async find(id: number, userId: number): Promise<Claim> {
    const claim = await this.repository.findOwned(id, userId);
    if (!claim) throw new AppError('NOT_FOUND', 404, 'Claim not found');
    return claim;
  }
  create(userId: number, input: ClaimInput) {
    return this.repository.create(userId, input);
  }
  async updateStatus(
    id: number,
    reportOwnerId: number,
    decision: ClaimStatusDecision,
  ): Promise<Claim> {
    const claim = await this.repository.reviewReportClaim(
      id,
      reportOwnerId,
      decision,
    );
    if (!claim) throw new AppError('NOT_FOUND', 404, 'Claim not found');
    return claim;
  }
  async listForReport(
    reportId: number,
    reportOwnerId: number,
    page: Page,
  ): Promise<Claim[]> {
    return this.repository.listForReportOwner(reportId, reportOwnerId, page);
  }
  async confirmHandover(id: number, userId: number): Promise<Claim> {
    const claim = await this.repository.confirmHandover(id, userId);
    if (!claim) throw new AppError('NOT_FOUND', 404, 'Claim not found');
    return claim;
  }
}
