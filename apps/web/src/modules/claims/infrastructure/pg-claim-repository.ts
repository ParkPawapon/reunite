import 'server-only';
import { query, type Sql } from '@campus/database';
import { AppError, type Page } from '@campus/shared';
import type {
  Claim,
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
  async listOwned(userId: number, page: Page): Promise<Claim[]> {
    const rows = await query<Row>(
      this.db,
      `SELECT ${columns} FROM claims
       WHERE user_id = $1 ORDER BY claim_id DESC LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset],
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
      `INSERT INTO claims (report_id, user_id, evidence) VALUES ($1, $2, $3) RETURNING ${columns}`,
      [input.reportId, userId, input.evidence],
    );
    if (!row) throw new Error('Claim insert returned no row');
    return map(row);
  }
  async reviewReportClaim(
    _claimId: number,
    _reportOwnerId: number,
    _decision: ClaimStatusDecision,
  ): Promise<Claim | null> {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE010 is awaiting implementation',
    );
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
