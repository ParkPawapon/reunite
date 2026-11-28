import 'server-only';
import { query, type Sql } from '@campus/database';
import { AppError, type Page } from '@campus/shared';
import type {
  Claim,
  ClaimBrowse,
  ClaimRepository,
  ClaimInput,
  ClaimStatusDecision,
} from '../domain/claim';

type Row = {
  claim_id: number;
  report_id: number;
  user_id: number;
  evidence: string;
  status: Claim['status'];
  resolution_note?: string | null;
  resolved_by?: number | null;
  finder_confirmed_at: Date | null;
  claimant_confirmed_at: Date | null;
  claim_date: Date;
  updated_at: Date;
};
const columns =
  'claim_id, report_id, user_id, evidence, status, resolution_note, resolved_by, claim_date, updated_at, finder_confirmed_at, claimant_confirmed_at';
const claimColumns = columns
  .split(', ')
  .map((column) => `c.${column}`)
  .join(', ');
const map = (row: Row): Claim => ({
  claimId: row.claim_id,
  reportId: row.report_id,
  userId: row.user_id,
  evidence: row.evidence,
  status: row.status,
  ...(row.resolution_note !== null && row.resolution_note !== undefined
    ? { resolutionNote: row.resolution_note }
    : {}),
  ...(row.resolved_by !== null && row.resolved_by !== undefined
    ? { resolvedBy: row.resolved_by }
    : {}),
  claimDate: row.claim_date.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  ...(row.finder_confirmed_at
    ? { finderConfirmedAt: row.finder_confirmed_at.toISOString() }
    : {}),
  ...(row.claimant_confirmed_at
    ? { claimantConfirmedAt: row.claimant_confirmed_at.toISOString() }
    : {}),
});
export class PgClaimRepository implements ClaimRepository {
  constructor(private readonly db: Sql) {}
  async listOwned(userId: number, page: ClaimBrowse): Promise<Claim[]> {
    const rows = await query<Row>(
      this.db,
      `SELECT ${columns} FROM claims
       WHERE user_id = $1 AND ($4::integer IS NULL OR report_id = $4)
       ORDER BY claim_id DESC LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset, page.reportId ?? null],
    );
    return rows.map(map);
  }
  async findOwned(id: number, userId: number): Promise<Claim | null> {
    const [row] = await query<Row>(
      this.db,
      `SELECT ${columns} FROM claims WHERE claim_id = $1 AND user_id = $2`,
      [id, userId],
    );
    return row ? map(row) : null;
  }
  async create(userId: number, input: ClaimInput) {
    const [row] = await query<Row>(
      this.db,
      `WITH eligible AS (
        SELECT user_id FROM item_reports
        WHERE report_id = $1 AND user_id <> $2 AND type = 'FOUND' AND status = 'OPEN'
        FOR UPDATE
      ), submitted AS (
        INSERT INTO claims (report_id, user_id, evidence)
        SELECT $1, $2, $3 FROM eligible
        RETURNING ${columns}
      ), notified AS (
        INSERT INTO notifications (user_id, kind, report_id)
        SELECT eligible.user_id, 'CLAIM_SUBMITTED', submitted.report_id FROM eligible CROSS JOIN submitted
      )
      SELECT ${columns} FROM submitted`,
      [input.reportId, userId, input.evidence],
    );
    if (!row)
      throw new AppError(
        'INVALID_REFERENCE',
        422,
        'Report is not eligible for claims',
      );
    return map(row);
  }
  async reviewReportClaim(
    claimId: number,
    reportOwnerId: number,
    decision: ClaimStatusDecision,
  ): Promise<Claim | null> {
    const [row] = await query<Row>(
      this.db,
      `WITH eligible AS (
         SELECT r.report_id
         FROM item_reports r JOIN claims c USING (report_id)
         WHERE c.claim_id = $1 AND r.user_id = $2
           AND r.type = 'FOUND' AND r.status = 'OPEN'
         FOR UPDATE OF r
       ), reviewed AS (UPDATE claims c
       SET status = $3,
           resolution_note = $4,
           resolved_by = $2,
           updated_at = NOW()
       FROM eligible r
       WHERE c.report_id = r.report_id
         AND c.claim_id = $1
         AND c.status = 'PENDING'
       RETURNING ${claimColumns}
       ), notified AS (
         INSERT INTO notifications (user_id, kind, report_id)
         SELECT user_id, CASE WHEN status = 'APPROVED' THEN 'CLAIM_APPROVED' ELSE 'CLAIM_REJECTED' END, report_id
         FROM reviewed
       ) SELECT ${columns} FROM reviewed`,
      [
        claimId,
        reportOwnerId,
        decision.status,
        decision.resolutionNote ?? null,
      ],
    );
    return row ? map(row) : null;
  }
  async confirmHandover(claimId: number, userId: number) {
    const [row] = await query<Row>(
      this.db,
      `WITH report AS (
         SELECT r.report_id, r.user_id AS finder_id, r.status
         FROM item_reports r JOIN claims c USING (report_id)
         WHERE c.claim_id = $1 AND r.type = 'FOUND'
           AND $2 IN (r.user_id, c.user_id)
         FOR UPDATE OF r
       ), eligible AS (
         SELECT ${claimColumns}, r.finder_id,
                CASE WHEN r.finder_id = $2 THEN c.finder_confirmed_at
                     ELSE c.claimant_confirmed_at END AS confirmed_at
         FROM claims c JOIN report r USING (report_id)
         WHERE c.claim_id = $1 AND c.status = 'APPROVED'
           AND (r.status = 'OPEN'
             OR (c.finder_confirmed_at IS NOT NULL AND c.claimant_confirmed_at IS NOT NULL))
         FOR UPDATE OF c
       ), confirmed AS (
         UPDATE claims c SET
           finder_confirmed_at = CASE WHEN e.finder_id = $2 THEN NOW() ELSE c.finder_confirmed_at END,
           claimant_confirmed_at = CASE WHEN e.user_id = $2 THEN NOW() ELSE c.claimant_confirmed_at END,
           updated_at = NOW()
         FROM eligible e WHERE c.claim_id = e.claim_id AND e.confirmed_at IS NULL
         RETURNING ${claimColumns}
       ), returned AS (
         UPDATE item_reports r SET status = 'RESOLVED', updated_at = NOW()
         FROM confirmed c WHERE r.report_id = c.report_id AND r.status = 'OPEN'
           AND c.finder_confirmed_at IS NOT NULL AND c.claimant_confirmed_at IS NOT NULL
         RETURNING r.report_id
       ), notified AS (
         INSERT INTO notifications (user_id, kind, report_id)
         SELECT CASE WHEN e.finder_id = $2 THEN e.user_id ELSE e.finder_id END,
                CASE WHEN r.report_id IS NULL THEN 'CLAIM_PARTNER_CONFIRMED' ELSE 'CLAIM_RETURNED' END,
                c.report_id
         FROM confirmed c JOIN eligible e USING (claim_id)
         LEFT JOIN returned r ON r.report_id = c.report_id
       )
       SELECT ${columns} FROM confirmed
       UNION ALL
       SELECT ${columns} FROM eligible WHERE confirmed_at IS NOT NULL`,
      [claimId, userId],
    );
    return row ? map(row) : null;
  }
  async listForReportOwner(
    reportId: number,
    reportOwnerId: number,
    page: Page,
  ): Promise<Claim[]> {
    const [ownedReport] = await query<{ report_id: number }>(
      this.db,
      'SELECT report_id FROM item_reports WHERE report_id = $1 AND user_id = $2',
      [reportId, reportOwnerId],
    );
    if (!ownedReport) throw new AppError('NOT_FOUND', 404, 'Report not found');

    const rows = await query<Row>(
      this.db,
      `SELECT ${claimColumns}
       FROM claims c
       WHERE c.report_id = $1
       ORDER BY c.claim_id DESC
       LIMIT $2 OFFSET $3`,
      [reportId, page.limit, page.offset],
    );
    return rows.map(map);
  }
}
