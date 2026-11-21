import 'server-only';
import {
  databaseErrorCode,
  query,
  withTransaction,
  type Sql,
} from '@campus/database';
import { AppError } from '@campus/shared';
import type { Pool } from 'pg';
import type {
  MatchItem,
  MatchReturn,
  MatchReturnRepository,
  MatchRevision,
} from '../domain/match-return';

type PairRow = {
  match_id: number;
  role: MatchReturn['role'];
  lost_revision: string;
  found_revision: string;
  lost: MatchItem;
  found: MatchItem;
  lost_confirmed_at: Date | null;
  found_confirmed_at: Date | null;
  returned_at: Date | null;
  current_suggestion: boolean;
};

async function ownedPair(db: Sql, matchId: number, userId: number) {
  const [row] = await query<PairRow>(
    db,
    `SELECT m.match_id, m.lost_revision::text, m.found_revision::text,
      CASE WHEN l.user_id=$2 THEN 'LOST' ELSE 'FOUND' END AS role,
      m.lost_confirmed_at, m.found_confirmed_at, m.returned_at,
      COALESCE(m.state='complete' AND m.result->>'decision'='possible_match'
        AND l.matching_revision=m.lost_revision AND f.matching_revision=m.found_revision
        AND l.status='OPEN' AND f.status='OPEN', FALSE) AS current_suggestion,
      json_build_object(
        'reportId', l.report_id, 'title', l.title, 'description', l.description,
        'location', ll.location_name, 'occurredAt', l.event_datetime, 'hasPhoto', l.image_data IS NOT NULL
      ) AS lost,
      json_build_object(
        'reportId', f.report_id, 'title', f.title, 'description', f.description,
        'location', fl.location_name, 'occurredAt', f.event_datetime, 'hasPhoto', f.image_data IS NOT NULL
      ) AS found
      FROM report_matches m
      JOIN item_reports l ON l.report_id=m.lost_report_id
      JOIN item_reports f ON f.report_id=m.found_report_id
      JOIN locations ll ON ll.location_id=l.location_id
      JOIN locations fl ON fl.location_id=f.location_id
      WHERE m.match_id=$1 AND $2 IN (l.user_id,f.user_id)
        AND l.user_id<>f.user_id AND l.type='LOST' AND f.type='FOUND' AND m.notified`,
    [matchId, userId],
  );
  return row;
}

function toMatchReturn(row: PairRow): MatchReturn {
  return {
    matchId: row.match_id,
    role: row.role,
    lostRevision: row.lost_revision,
    foundRevision: row.found_revision,
    lost: {
      ...row.lost,
      occurredAt: new Date(row.lost.occurredAt).toISOString(),
    },
    found: {
      ...row.found,
      occurredAt: new Date(row.found.occurredAt).toISOString(),
    },
    lostConfirmedAt: row.lost_confirmed_at?.toISOString() ?? null,
    foundConfirmedAt: row.found_confirmed_at?.toISOString() ?? null,
    returnedAt: row.returned_at?.toISOString() ?? null,
  };
}

export class PgMatchReturnRepository implements MatchReturnRepository {
  constructor(private readonly pool: Pool) {}

  async find(matchId: number, userId: number) {
    const row = await ownedPair(this.pool, matchId, userId);
    return row && (row.current_suggestion || row.returned_at)
      ? toMatchReturn(row)
      : null;
  }

  async confirm(matchId: number, userId: number, revision: MatchRevision) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await withTransaction(this.pool, async (db) => {
          // Edits and provider publication also acquire report locks before pair writes.
          await query(
            db,
            `SELECT r.report_id FROM item_reports r JOIN report_matches m
              ON r.report_id IN (m.lost_report_id,m.found_report_id)
            WHERE m.match_id=$1 AND m.notified AND EXISTS (
              SELECT 1 FROM item_reports owned
              WHERE owned.report_id IN (m.lost_report_id,m.found_report_id) AND owned.user_id=$2
            )
            ORDER BY r.report_id FOR NO KEY UPDATE OF r`,
            [matchId, userId],
          );
          const pair = await ownedPair(db, matchId, userId);
          if (!pair) throw new AppError('NOT_FOUND', 404, 'Match not found');
          if (
            pair.lost_revision !== revision.lostRevision ||
            pair.found_revision !== revision.foundRevision ||
            (!pair.returned_at && !pair.current_suggestion)
          )
            throw new AppError('MATCH_CHANGED', 409, 'This match changed');

          const isLost = pair.role === 'LOST';
          const ownConfirmation = isLost
            ? pair.lost_confirmed_at
            : pair.found_confirmed_at;
          if (ownConfirmation) return toMatchReturn(pair);
          const bothConfirmed = Boolean(
            isLost ? pair.found_confirmed_at : pair.lost_confirmed_at,
          );
          const reportIds = [pair.lost.reportId, pair.found.reportId];
          await query(
            db,
            `UPDATE report_matches SET
              lost_confirmed_at=CASE WHEN $2 THEN statement_timestamp() ELSE lost_confirmed_at END,
              found_confirmed_at=CASE WHEN $2 THEN found_confirmed_at ELSE statement_timestamp() END,
              returned_at=CASE WHEN $3 THEN statement_timestamp() ELSE NULL END
            WHERE match_id=$1`,
            [matchId, isLost, bothConfirmed],
          );
          if (bothConfirmed) {
            const resolved = await query(
              db,
              `UPDATE item_reports SET status='RESOLVED'
                WHERE report_id=ANY($1::integer[]) AND status='OPEN' RETURNING report_id`,
              [reportIds],
            );
            if (resolved.length !== 2)
              throw new AppError('MATCH_CHANGED', 409, 'This match changed');
          }
          await query(
            db,
            `INSERT INTO notifications(user_id,kind,match_id)
              SELECT user_id,$2,$1 FROM item_reports
              WHERE report_id=ANY($3::integer[]) AND ($4 OR user_id<>$5)`,
            [
              matchId,
              bothConfirmed ? 'MATCH_RETURNED' : 'MATCH_PARTNER_CONFIRMED',
              reportIds,
              bothConfirmed,
              userId,
            ],
          );
          const updated = await ownedPair(db, matchId, userId);
          if (!updated)
            throw new Error('Confirmed match missing inside transaction');
          return toMatchReturn(updated);
        });
      } catch (error) {
        // A report edit can also invalidate another pair that shares its report.
        if (!['40P01', '40001'].includes(databaseErrorCode(error) ?? ''))
          throw error;
        if (attempt === 2)
          throw new AppError('UNAVAILABLE', 503, 'Try confirming again');
      }
    }
  }
}
