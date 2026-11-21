import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { query, withTransaction, type Sql } from '@campus/database';
import type {
  MatchItem,
  MatchJob,
  MatchingQueue,
  ProviderResult,
} from '../domain/matching';

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
      const [row] = await query<{
        match_id: number;
        lost_report_id: number;
        found_report_id: number;
      }>(
        db,
        `SELECT m.match_id,m.lost_report_id,m.found_report_id
        FROM report_matches m JOIN item_reports l ON l.report_id=m.lost_report_id
        JOIN item_reports f ON f.report_id=m.found_report_id
        WHERE ((m.state='queued' AND m.available_at<=CURRENT_TIMESTAMP) OR
          (m.state='processing' AND m.leased_until<CURRENT_TIMESTAMP)) AND m.attempts<3
          AND l.status='OPEN' AND f.status='OPEN' AND l.type='LOST' AND f.type='FOUND' AND l.user_id<>f.user_id
          AND l.matching_revision=m.lost_revision AND f.matching_revision=m.found_revision
        ORDER BY (l.category_id=f.category_id) DESC,m.available_at,m.match_id
        LIMIT 1 FOR UPDATE OF m SKIP LOCKED`,
      );
      if (!row) return null;
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
