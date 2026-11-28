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
  claim_date: Date;
  updated_at: Date;
};
const columns =
  'claim_id, report_id, user_id, evidence, status, resolution_note, resolved_by, claim_date, updated_at';
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
      `WITH reviewed AS (UPDATE claims c
       SET status = $3,
           resolution_note = $4,
           resolved_by = $2,
           updated_at = NOW()
       FROM item_reports r
       WHERE c.report_id = r.report_id
         AND c.claim_id = $1
         AND r.user_id = $2
         AND c.status = 'PENDING'
       RETURNING c.claim_id, c.report_id, c.user_id, c.evidence, c.status,
                 c.resolution_note, c.resolved_by, c.claim_date, c.updated_at
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
      `SELECT c.claim_id, c.report_id, c.user_id, c.evidence, c.status,
              c.resolution_note, c.resolved_by, c.claim_date, c.updated_at
       FROM claims c
       WHERE c.report_id = $1
       ORDER BY c.claim_id DESC
       LIMIT $2 OFFSET $3`,
      [reportId, page.limit, page.offset],
    );
    return rows.map(map);
  }
}
