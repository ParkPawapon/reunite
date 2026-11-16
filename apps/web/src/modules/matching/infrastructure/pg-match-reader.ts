import 'server-only';
import { query, type Sql } from '@campus/database';
import type { MatchReader } from '../domain/match-reader';
import { assessmentSchema } from './openai-matching-provider';
export class PgMatchReader implements MatchReader {
  constructor(private readonly db: Sql) {}
  async listOwned(userId: number, before?: number) {
    type Row = {
      match_id: number;
      own_id: number;
      own_title: string;
      candidate_id: number;
      candidate_title: string;
      result: unknown;
      completed_at: Date;
    };
    const rows = await query<Row>(
      this.db,
      `SELECT m.match_id,
      CASE WHEN l.user_id=$1 THEN l.report_id ELSE f.report_id END AS own_id,
      CASE WHEN l.user_id=$1 THEN l.title ELSE f.title END AS own_title,
      CASE WHEN l.user_id=$1 THEN f.report_id ELSE l.report_id END AS candidate_id,
      CASE WHEN l.user_id=$1 THEN f.title ELSE l.title END AS candidate_title,m.result,m.completed_at
      FROM report_matches m JOIN item_reports l ON l.report_id=m.lost_report_id
      JOIN item_reports f ON f.report_id=m.found_report_id
      WHERE (l.user_id=$1 OR f.user_id=$1) AND l.status='OPEN' AND f.status='OPEN'
        AND l.matching_revision=m.lost_revision AND f.matching_revision=m.found_revision
        AND m.state='complete' AND m.result->>'decision'='possible_match'
        AND ($2::integer IS NULL OR m.match_id<$2) ORDER BY m.match_id DESC LIMIT 21`,
      [userId, before ?? null],
    );
    const [counts] = await query<{
      pending: number;
      failed: number;
      reserved: string;
    }>(
      this.db,
      `SELECT
      (SELECT count(*)::integer FROM report_matches m JOIN item_reports l ON l.report_id=m.lost_report_id
        JOIN item_reports f ON f.report_id=m.found_report_id WHERE (l.user_id=$1 OR f.user_id=$1)
        AND l.status='OPEN' AND f.status='OPEN' AND m.state IN ('queued','processing')) AS pending,
      (SELECT count(*)::integer FROM report_matches m JOIN item_reports l ON l.report_id=m.lost_report_id
        JOIN item_reports f ON f.report_id=m.found_report_id WHERE (l.user_id=$1 OR f.user_id=$1)
        AND l.status='OPEN' AND f.status='OPEN' AND m.state='failed') AS failed,
      (SELECT COALESCE(sum(reserved_usd_micros),0)::text FROM report_matches) AS reserved`,
      [userId],
    );
    const items = rows.slice(0, 20).map((r) => ({
      matchId: r.match_id,
      ownReportId: r.own_id,
      ownTitle: r.own_title,
      candidateReportId: r.candidate_id,
      candidateTitle: r.candidate_title,
      assessment: assessmentSchema.parse(r.result),
      completedAt: r.completed_at.toISOString(),
    }));
    return {
      items,
      nextCursor: rows.length > 20 ? (items.at(-1)?.matchId ?? null) : null,
      pendingCount: counts?.pending ?? 0,
      failedCount: counts?.failed ?? 0,
      reservedUsdMicros: Number(counts?.reserved ?? 0),
    };
  }
}
