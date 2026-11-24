import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { query, withTransaction, type Sql } from '@campus/database';
import type {
  MatchAssessment,
  MatchItem,
  MatchJob,
  MatchingQueue,
  ProviderResult,
} from '../domain/matching';
import { scoreTextPairForQueue } from '../domain/text-similarity';

type ItemRow = {
  title: string;
  description: string | null;
  category_name: string;
  location_name: string;
  event_datetime: Date;
  image_data: Buffer | null;
};
const item = (row: ItemRow): MatchItem => ({
  title: row.title,
  description: row.description,
  category: row.category_name,
  location: row.location_name,
  eventDatetime: row.event_datetime.toISOString(),
  image: row.image_data,
});
async function loadItem(db: Sql, id: number) {
  const [row] = await query<ItemRow>(
    db,
    `SELECT r.title,r.description,c.category_name,l.location_name,
    r.event_datetime,r.image_data FROM item_reports r
    JOIN categories c USING(category_id) JOIN locations l USING(location_id) WHERE r.report_id=$1`,
    [id],
  );
  if (!row) throw new Error('Matching report unavailable');
  return item(row);
}

type CandidateRow = {
  match_id: number;
  lost_report_id: number;
  found_report_id: number;
  lost_title: string;
  lost_description: string | null;
  lost_category: string;
  lost_location: string;
  lost_event_datetime: Date;
  lost_has_image: boolean;
  found_title: string;
  found_description: string | null;
  found_category: string;
  found_location: string;
  found_event_datetime: Date;
  found_has_image: boolean;
  same_category: boolean;
};

function prefilterResult(row: CandidateRow, summary: string): MatchAssessment {
  const imageCount = Number(row.lost_has_image) + Number(row.found_has_image);
  return {
    decision: 'different_item',
    summary,
    evidence: [
      {
        attribute: 'object_type',
        relation: 'conflict',
        detail: `คนละหมวดหมู่ (${row.lost_category} / ${row.found_category}) และไม่พบคำสำคัญตรงกัน`,
      },
    ],
    missingEvidence: [],
    imageComparison:
      imageCount === 2 ? 'both' : imageCount === 1 ? 'one' : 'none',
  };
}

export class PgMatchingQueue implements MatchingQueue {
  constructor(
    private readonly pool: Pool,
    private readonly freeDailyLimit?: number,
  ) {}
  async reconcile() {
    // Recovers pairs inserted concurrently in separate report transactions and legacy reports.
    // No category/date hard exclusion: those fields can be wrong or missing in a real report.
    await query(
      this.pool,
      `INSERT INTO report_matches(lost_report_id,found_report_id,lost_revision,found_revision)
      SELECT l.report_id,f.report_id,l.matching_revision,f.matching_revision
      FROM item_reports l JOIN item_reports f ON f.type='FOUND' AND f.status='OPEN' AND f.user_id<>l.user_id
      LEFT JOIN report_matches m ON m.lost_report_id=l.report_id AND m.found_report_id=f.report_id
      WHERE l.type='LOST' AND l.status='OPEN' AND
        (m.match_id IS NULL OR m.lost_revision<>l.matching_revision OR m.found_revision<>f.matching_revision)
      ORDER BY l.report_id,f.report_id LIMIT 200
      ON CONFLICT(lost_report_id,found_report_id) DO UPDATE SET
        lost_revision=EXCLUDED.lost_revision,found_revision=EXCLUDED.found_revision,
        state='queued',attempts=0,available_at=CURRENT_TIMESTAMP,lease_token=NULL,leased_until=NULL,
        result=NULL,model=NULL,provider_response_id=NULL,error_code=NULL,completed_at=NULL
      WHERE report_matches.lost_revision<=EXCLUDED.lost_revision
        AND report_matches.found_revision<=EXCLUDED.found_revision
        AND (report_matches.lost_revision<>EXCLUDED.lost_revision OR report_matches.found_revision<>EXCLUDED.found_revision)`,
    );
  }
  async claim(
    budgetUsdMicros: number,
    reservationUsdMicros: number,
  ): Promise<MatchJob | null> {
    if (
      this.freeDailyLimit === undefined &&
      (!Number.isSafeInteger(budgetUsdMicros) ||
        !Number.isSafeInteger(reservationUsdMicros) ||
        reservationUsdMicros <= 0)
    )
      throw new Error('Invalid matching budget');
    return withTransaction(this.pool, async (db) => {
      // A fresh statement after the lock is essential: a pre-lock snapshot can overspend.
      await query(db, 'SELECT pg_advisory_xact_lock($1,$2)', [20261116, 2]);
      await query(
        db,
        `UPDATE report_matches SET state='failed',lease_token=NULL,leased_until=NULL,
        error_code='LEASE_EXHAUSTED' WHERE state='processing' AND leased_until<CURRENT_TIMESTAMP AND attempts>=3`,
      );
      let quotaDay: string | null = null;
      if (this.freeDailyLimit !== undefined) {
        const [day] = await query<{ utc_day: string }>(
          db,
          `SELECT (statement_timestamp() AT TIME ZONE 'UTC')::date::text AS utc_day`,
        );
        if (!day) throw new Error('Matching quota day unavailable');
        quotaDay = day.utc_day;
        const [usage] = await query<{
          attempts: number;
          cooling_down: boolean;
        }>(
          db,
          `SELECT COALESCE(SUM(free_attempts_today),0)::integer AS attempts,
            EXISTS(SELECT 1 FROM report_matches WHERE free_quota_day IS NOT NULL
              AND error_code='PROVIDER_RATE_LIMITED' AND available_at>statement_timestamp()) AS cooling_down
           FROM report_matches WHERE free_quota_day=$1::date`,
          [quotaDay],
        );
        if (
          usage?.cooling_down ||
          (usage?.attempts ?? 0) >= this.freeDailyLimit
        )
          return null;
      } else {
        const [usage] = await query<{ reserved: string }>(
          db,
          'SELECT COALESCE(SUM(reserved_usd_micros),0)::text AS reserved FROM report_matches',
        );
        if (
          Number(usage?.reserved ?? 0) + reservationUsdMicros >
          budgetUsdMicros
        )
          return null;
      }
      let row: {
        match_id: number;
        lost_report_id: number;
        found_report_id: number;
      } | null = null;
      while (!row) {
        const candidates = await query<CandidateRow>(
          db,
          `SELECT m.match_id, m.lost_report_id, m.found_report_id,
            l.title AS lost_title, l.description AS lost_description,
            lc.category_name AS lost_category, ll.location_name AS lost_location,
            l.event_datetime AS lost_event_datetime, (l.image_data IS NOT NULL) AS lost_has_image,
            f.title AS found_title, f.description AS found_description,
            fc.category_name AS found_category, fl.location_name AS found_location,
            f.event_datetime AS found_event_datetime, (f.image_data IS NOT NULL) AS found_has_image,
            (l.category_id = f.category_id) AS same_category
          FROM report_matches m
          JOIN item_reports l ON l.report_id = m.lost_report_id
          JOIN categories lc ON lc.category_id = l.category_id
          JOIN locations ll ON ll.location_id = l.location_id
          JOIN item_reports f ON f.report_id = m.found_report_id
          JOIN categories fc ON fc.category_id = f.category_id
          JOIN locations fl ON fl.location_id = f.location_id
          WHERE ((m.state = 'queued' AND m.available_at <= CURRENT_TIMESTAMP) OR
            (m.state = 'processing' AND m.leased_until < CURRENT_TIMESTAMP)) AND m.attempts < 3
            AND l.status = 'OPEN' AND f.status = 'OPEN' AND l.type = 'LOST' AND f.type = 'FOUND' AND l.user_id <> f.user_id
            AND l.matching_revision = m.lost_revision AND f.matching_revision = m.found_revision
          ORDER BY (l.category_id = f.category_id) DESC, m.available_at, m.match_id
          LIMIT 100`,
        );
        if (!candidates.length) return null;

        const rejectedIds: number[] = [];
        const rejectedResults: string[] = [];
        const plausible: { candidate: CandidateRow; score: number }[] = [];
        for (const candidate of candidates) {
          const scored = scoreTextPairForQueue(
            {
              title: candidate.lost_title,
              description: candidate.lost_description,
              category: candidate.lost_category,
              location: candidate.lost_location,
              eventDatetime: candidate.lost_event_datetime,
            },
            {
              title: candidate.found_title,
              description: candidate.found_description,
              category: candidate.found_category,
              location: candidate.found_location,
              eventDatetime: candidate.found_event_datetime,
            },
          );
          if (scored.fastReject) {
            rejectedIds.push(candidate.match_id);
            rejectedResults.push(
              JSON.stringify(
                prefilterResult(candidate, scored.comparison.summary),
              ),
            );
          } else {
            const visualBonus =
              candidate.lost_has_image && candidate.found_has_image ? 5 : 0;
            plausible.push({
              candidate,
              score: scored.priorityScore + visualBonus,
            });
          }
        }

        if (rejectedIds.length > 0) {
          await query(
            db,
            `UPDATE report_matches m
            SET state = 'complete',
              result = skipped.result,
              model = 'local-prefilter-v1',
              completed_at = CURRENT_TIMESTAMP,
              lease_token = NULL,
              leased_until = NULL,
              error_code = NULL
            FROM unnest($1::integer[], $2::jsonb[]) AS skipped(match_id, result)
            WHERE m.match_id = skipped.match_id
              AND ((m.state = 'queued' AND m.available_at <= CURRENT_TIMESTAMP) OR
                (m.state = 'processing' AND m.leased_until < CURRENT_TIMESTAMP))`,
            [rejectedIds, rejectedResults],
          );
        }

        if (!plausible.length) {
          if (candidates.length < 100) return null;
          continue;
        }

        plausible.sort(
          (a, b) =>
            b.score - a.score ||
            Number(b.candidate.same_category) -
              Number(a.candidate.same_category) ||
            a.candidate.match_id - b.candidate.match_id,
        );
        const top = plausible[0];
        if (!top) return null;

        const [locked] = await query<{
          match_id: number;
          lost_report_id: number;
          found_report_id: number;
        }>(
          db,
          `SELECT m.match_id, m.lost_report_id, m.found_report_id
          FROM report_matches m
          WHERE m.match_id = $1
            AND ((m.state = 'queued' AND m.available_at <= CURRENT_TIMESTAMP) OR
              (m.state = 'processing' AND m.leased_until < CURRENT_TIMESTAMP))
            AND m.attempts < 3
          FOR UPDATE OF m SKIP LOCKED`,
          [top.candidate.match_id],
        );
        if (locked) {
          row = locked;
        } else if (candidates.length < 100) {
          return null;
        }
      }
      const leaseToken = randomUUID();
      await query(
        db,
        `UPDATE report_matches SET state='processing',attempts=attempts+1,
        lease_token=$2,leased_until=CURRENT_TIMESTAMP+INTERVAL '2 minutes',
        reserved_usd_micros=reserved_usd_micros+$3,error_code=NULL,
        free_attempts_today=CASE
          WHEN $4::date IS NULL THEN free_attempts_today
          WHEN free_quota_day=$4::date THEN free_attempts_today+1
          ELSE 1 END,
        free_quota_day=COALESCE($4::date,free_quota_day)
        WHERE match_id=$1`,
        [
          row.match_id,
          leaseToken,
          quotaDay ? 0 : reservationUsdMicros,
          quotaDay,
        ],
      );
      const [lost, found] = await Promise.all([
        loadItem(db, row.lost_report_id),
        loadItem(db, row.found_report_id),
      ]);
      return { matchId: row.match_id, leaseToken, lost, found };
    });
  }
  async complete(job: MatchJob, result: ProviderResult) {
    return withTransaction(this.pool, async (db) => {
      // Serialize publication with edits: report writes acquire report rows before pair rows.
      await query(
        db,
        `SELECT r.report_id FROM item_reports r JOIN report_matches m
        ON r.report_id IN (m.lost_report_id,m.found_report_id)
        WHERE m.match_id=$1 ORDER BY r.report_id FOR SHARE OF r`,
        [job.matchId],
      );
      const [row] = await query<{
        lost_report_id: number;
        found_report_id: number;
        notified: boolean;
      }>(
        db,
        `UPDATE report_matches m
        SET state='complete',result=$3::jsonb,model=$4,provider_response_id=$5,
          estimated_usd_micros=estimated_usd_micros+$6,completed_at=CURRENT_TIMESTAMP,
          lease_token=NULL,leased_until=NULL,error_code=NULL
        FROM item_reports l,item_reports f
        WHERE m.match_id=$1 AND m.lease_token=$2 AND m.state='processing' AND m.leased_until>CURRENT_TIMESTAMP
          AND l.report_id=m.lost_report_id AND f.report_id=m.found_report_id
          AND l.matching_revision=m.lost_revision AND f.matching_revision=m.found_revision
          AND l.status='OPEN' AND f.status='OPEN'
        RETURNING m.lost_report_id,m.found_report_id,m.notified`,
        [
          job.matchId,
          job.leaseToken,
          JSON.stringify(result.assessment),
          result.model,
          result.responseId,
          result.estimatedUsdMicros,
        ],
      );
      if (!row) return false;
      if (result.assessment.decision === 'possible_match' && !row.notified) {
        await query(
          db,
          `INSERT INTO notifications(user_id,kind,match_id)
          SELECT user_id,'MATCH_SUGGESTED',$2 FROM item_reports WHERE report_id=ANY($1::integer[])`,
          [[row.lost_report_id, row.found_report_id], job.matchId],
        );
        await query(
          db,
          'UPDATE report_matches SET notified=TRUE WHERE match_id=$1',
          [job.matchId],
        );
      }
      return true;
    });
  }
  async fail(
    job: MatchJob,
    code: string,
    retryable: boolean,
    retryAfterSeconds = 0,
  ) {
    await query(
      this.pool,
      `UPDATE report_matches SET
      state=CASE WHEN $4::boolean AND attempts<3 THEN 'queued' ELSE 'failed' END,
      available_at=CURRENT_TIMESTAMP + GREATEST(30 * attempts, $5::integer) * INTERVAL '1 second',
      lease_token=NULL,leased_until=NULL,error_code=$3
      WHERE match_id=$1 AND lease_token=$2 AND state='processing'`,
      [job.matchId, job.leaseToken, code, retryable, retryAfterSeconds],
    );
  }
}
