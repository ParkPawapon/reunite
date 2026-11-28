import type { MatchAssessment } from './matching';
export type MatchSuggestion = {
  matchId: number;
  ownReportId: number;
  ownTitle: string;
  candidateReportId: number;
  candidateTitle: string;
  assessment: MatchAssessment;
  completedAt: string;
};
export interface MatchReader {
  reportStatus(
    userId: number,
    reportId: number,
  ): Promise<ReportMatchingStatus | null>;
  listOwned(
    userId: number,
    before?: number,
  ): Promise<{
    items: MatchSuggestion[];
    nextCursor: number | null;
    pendingCount: number;
    failedCount: number;
    reservedUsdMicros: number;
    freeAttemptsToday: number;
  }>;
}

export type ReportMatchingStatus = {
  open: boolean;
  pendingCount: number;
  failedCount: number;
  checkedCount: number;
  latestMatchId: number | null;
};
