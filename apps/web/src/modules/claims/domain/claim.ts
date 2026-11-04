import type { ClaimStatus, Page } from '@campus/shared';

export type Claim = {
  claimId: number;
  reportId: number;
  userId: number;
  evidence: string;
  status: ClaimStatus;
  claimDate: string;
  updatedAt: string;
};
export type ClaimInput = { reportId: number; evidence: string };
export interface ClaimRepository {
  listOwned(userId: number, page: Page): Promise<Claim[]>;
  findOwned(id: number, userId: number): Promise<Claim | null>;
  create(userId: number, input: ClaimInput): Promise<Claim>;
}
