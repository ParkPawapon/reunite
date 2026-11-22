import type { ClaimStatus, Page } from '@campus/shared';

export type Claim = {
  claimId: number;
  reportId: number;
  userId: number;
  evidence: string;
  status: ClaimStatus;
  resolutionNote?: string | null;
  resolvedBy?: number | null;
  claimDate: string;
  updatedAt: string;
};
export type ClaimInput = { reportId: number; evidence: string };
export type ClaimBrowse = Page & { reportId?: number };
export type ClaimStatusDecision = {
  status: 'APPROVED' | 'REJECTED';
  resolutionNote?: string | null;
};

export interface ClaimRepository {
  listOwned(userId: number, page: ClaimBrowse): Promise<Claim[]>;
  findOwned(id: number, userId: number): Promise<Claim | null>;
  create(userId: number, input: ClaimInput): Promise<Claim>;
  reviewReportClaim(
    claimId: number,
    reportOwnerId: number,
    decision: ClaimStatusDecision,
  ): Promise<Claim | null>;
  listForReportOwner(
    reportId: number,
    reportOwnerId: number,
    page: Page,
  ): Promise<Claim[]>;
}
