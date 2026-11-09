import 'server-only';
import { query, type Sql } from '@campus/database';
import { AppError, type Page } from '@campus/shared';
import type { Claim, ClaimRepository, ClaimInput } from '../domain/claim';

type Row = {
  claim_id: number;
  report_id: number;
  user_id: number;
  evidence: string;
  status: Claim['status'];
  claim_date: Date;
  updated_at: Date;
};
const columns =
  'claim_id, report_id, user_id, evidence, status, claim_date, updated_at';
const map = (row: Row): Claim => ({
  claimId: row.claim_id,
  reportId: row.report_id,
  userId: row.user_id,
  evidence: row.evidence,
  status: row.status,
  claimDate: row.claim_date.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export class PgClaimRepository implements ClaimRepository {
  constructor(private readonly db: Sql) {}
  // BE007: implement parameterized SELECT scoped to user_id, ordered by claim_id DESC with LIMIT and OFFSET.
  async listOwned(_userId: number, _page: Page): Promise<Claim[]> {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE007 is awaiting implementation',
    );
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
}
