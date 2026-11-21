export type MatchRevision = { lostRevision: string; foundRevision: string };

export type MatchItem = {
  reportId: number;
  title: string;
  description: string | null;
  location: string;
  occurredAt: string;
  hasPhoto: boolean;
};

export type MatchReturn = MatchRevision & {
  matchId: number;
  role: 'LOST' | 'FOUND';
  lost: MatchItem;
  found: MatchItem;
  lostConfirmedAt: string | null;
  foundConfirmedAt: string | null;
  returnedAt: string | null;
};

export interface MatchReturnRepository {
  find(matchId: number, userId: number): Promise<MatchReturn | null>;
  confirm(
    matchId: number,
    userId: number,
    revision: MatchRevision,
  ): Promise<MatchReturn>;
}
