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
  async listOwned(userId: number, page: Page): Promise<Claim[]> {
    const rows = await query<Row>(
      this.db,
      `SELECT ${columns} FROM claims
       WHERE user_id = $1 ORDER BY claim_id DESC LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset],
    );
    return rows.map(map);
  }
  // BE008: implement parameterized SELECT scoped to claim_id and user_id, returning mapped Claim or null.
  async findOwned(_id: number, _userId: number): Promise<Claim | null> {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE008 is awaiting implementation',
    );
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
