import type { MatchAssessment } from './matching';
import type { TextComparison } from './text-similarity';

export type MatchRevision = { lostRevision: string; foundRevision: string };

export type MatchImageComparisonSummary = {
  status: 'both' | 'one' | 'none';
  level: 'similar' | 'moderate' | 'different' | 'unavailable';
  label: string;
  detail: string;
};

export type MatchItem = {
  reportId: number;
  title: string;
  description: string | null;
  category: string;
  location: string;
  occurredAt: string;
  hasPhoto: boolean;
  photoCount: number;
  photoUrls: string[];
};

export type MatchReturn = MatchRevision & {
  matchId: number;
  role: 'LOST' | 'FOUND';
  lost: MatchItem;
  found: MatchItem;
  lostConfirmedAt: string | null;
  foundConfirmedAt: string | null;
  returnedAt: string | null;
  textComparison: TextComparison;
  imageSimilarity: MatchImageComparisonSummary;
  assessment: MatchAssessment | null;
};

export interface MatchReturnRepository {
  find(matchId: number, userId: number): Promise<MatchReturn | null>;
  confirm(
    matchId: number,
    userId: number,
    revision: MatchRevision,
  ): Promise<MatchReturn>;
}
