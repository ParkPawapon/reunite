import 'server-only';
import {
  databaseErrorCode,
  query,
  withTransaction,
  type Sql,
} from '@campus/database';
import { AppError } from '@campus/shared';
import type { Pool } from 'pg';
import { reportPublisher } from '@/modules/item-reports/domain/report';
import type {
  MatchItem,
  MatchReturn,
  MatchReturnRepository,
  MatchRevision,
} from '../domain/match-return';
import { reportImageSlotHref } from '@/modules/item-reports/domain/report-image-policy';
import { analyzeMatchText } from '../domain/text-similarity';
import { compareMatchImagesLocally } from './image-comparison';
import { assessmentSchema } from './matching-provider-contract';

type PairRow = {
  match_id: number;
  role: MatchReturn['role'];
  lost_revision: string;
  found_revision: string;
  lost: Omit<MatchItem, 'photoCount' | 'photoUrls'>;
  found: Omit<MatchItem, 'photoCount' | 'photoUrls'>;
  lost_image_1: Buffer | null;
  lost_image_2: Buffer | null;
  lost_image_3: Buffer | null;
  found_image_1: Buffer | null;
  found_image_2: Buffer | null;
  found_image_3: Buffer | null;
  raw_assessment: unknown;
  lost_confirmed_at: Date | null;
  found_confirmed_at: Date | null;
  returned_at: Date | null;
  current_suggestion: boolean;
};

function slotUrls(reportId: number, slots: (Buffer | null)[]) {
  const urls: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) urls.push(reportImageSlotHref(reportId, i + 1));
  }
  return urls;
}

async function ownedPair(db: Sql, matchId: number, userId: number) {
  const [row] = await query<PairRow>(
    db,
    `SELECT m.match_id, m.lost_revision::text, m.found_revision::text,
      CASE WHEN l.user_id=$2 THEN 'LOST' ELSE 'FOUND' END AS role,
      m.lost_confirmed_at, m.found_confirmed_at, m.returned_at,
      m.result AS raw_assessment,
      l.image_data AS lost_image_1,
      l.image_data_2 AS lost_image_2,
      l.image_data_3 AS lost_image_3,
      f.image_data AS found_image_1,
      f.image_data_2 AS found_image_2,
      f.image_data_3 AS found_image_3,
      COALESCE(m.state='complete' AND m.result->>'decision'='possible_match'
        AND l.matching_revision=m.lost_revision AND f.matching_revision=m.found_revision
        AND l.status='OPEN' AND f.status='OPEN', FALSE) AS current_suggestion,
      json_build_object(
        'reportId', l.report_id, 'title', l.title, 'description', l.description,
        'category', lc.category_name, 'location', ll.location_name,
        'occurredAt', l.event_datetime,
        'hasPhoto', (l.image_data IS NOT NULL OR l.image_data_2 IS NOT NULL OR l.image_data_3 IS NOT NULL),
        'publisher', json_build_object('name', lu.name, 'email', lu.email, 'phone', lu.phone)
      ) AS lost,
      json_build_object(
        'reportId', f.report_id, 'title', f.title, 'description', f.description,
        'category', fc.category_name, 'location', fl.location_name,
        'occurredAt', f.event_datetime,
        'hasPhoto', (f.image_data IS NOT NULL OR f.image_data_2 IS NOT NULL OR f.image_data_3 IS NOT NULL),
        'publisher', json_build_object('name', fu.name, 'email', fu.email, 'phone', fu.phone)
      ) AS found
      FROM report_matches m
      JOIN item_reports l ON l.report_id=m.lost_report_id
      JOIN item_reports f ON f.report_id=m.found_report_id
      JOIN categories lc ON lc.category_id=l.category_id
      JOIN categories fc ON fc.category_id=f.category_id
      JOIN users lu ON lu.user_id=l.user_id
      JOIN users fu ON fu.user_id=f.user_id
      JOIN locations ll ON ll.location_id=l.location_id
      JOIN locations fl ON fl.location_id=f.location_id
      WHERE m.match_id=$1 AND $2 IN (l.user_id,f.user_id)
        AND l.user_id<>f.user_id AND l.type='LOST' AND f.type='FOUND' AND m.notified`,
    [matchId, userId],
  );
  return row;
}

async function toMatchReturn(row: PairRow): Promise<MatchReturn> {
  const lostOccurredAt = new Date(row.lost.occurredAt).toISOString();
  const foundOccurredAt = new Date(row.found.occurredAt).toISOString();
  const lostSlots = [row.lost_image_1, row.lost_image_2, row.lost_image_3];
  const foundSlots = [row.found_image_1, row.found_image_2, row.found_image_3];
  const lostUrls = slotUrls(row.lost.reportId, lostSlots);
  const foundUrls = slotUrls(row.found.reportId, foundSlots);
  const textComparison = analyzeMatchText(
    {
      title: row.lost.title,
      description: row.lost.description,
      category: row.lost.category,
      location: row.lost.location,
      eventDatetime: lostOccurredAt,
    },
    {
      title: row.found.title,
      description: row.found.description,
      category: row.found.category,
      location: row.found.location,
      eventDatetime: foundOccurredAt,
    },
  );
  const imageSimilarity = await compareMatchImagesLocally(
    lostSlots,
    foundSlots,
  );
  const parsedAssessment = assessmentSchema.safeParse(row.raw_assessment);
  return {
    matchId: row.match_id,
    role: row.role,
    lostRevision: row.lost_revision,
    foundRevision: row.found_revision,
    lost: {
      ...row.lost,
      occurredAt: lostOccurredAt,
      photoCount: lostUrls.length,
      photoUrls: lostUrls,
      publisher: reportPublisher(row.lost.publisher),
    },
    found: {
      ...row.found,
      occurredAt: foundOccurredAt,
      photoCount: foundUrls.length,
      photoUrls: foundUrls,
      publisher: reportPublisher(row.found.publisher),
    },
    lostConfirmedAt: row.lost_confirmed_at?.toISOString() ?? null,
    foundConfirmedAt: row.found_confirmed_at?.toISOString() ?? null,
    returnedAt: row.returned_at?.toISOString() ?? null,
    textComparison,
    imageSimilarity,
    assessment: parsedAssessment.success ? parsedAssessment.data : null,
  };
}

export class PgMatchReturnRepository implements MatchReturnRepository {
  constructor(private readonly pool: Pool) {}

  async find(matchId: number, userId: number) {
    const row = await ownedPair(this.pool, matchId, userId);
    return row && (row.current_suggestion || row.returned_at)
      ? await toMatchReturn(row)
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
          if (ownConfirmation) return await toMatchReturn(pair);
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
          return await toMatchReturn(updated);
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
