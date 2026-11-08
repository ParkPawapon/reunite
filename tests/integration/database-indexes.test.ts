import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { migrate } from '../../packages/database/src/migrations';
import { isolatedDatabase } from './database-fixture';

const reportListSql = `SELECT report_id, user_id, category_id, location_id, type, title, description, image, event_datetime, status, created_at, updated_at FROM item_reports
  WHERE ($1::varchar IS NULL OR type = $1) AND ($2::varchar IS NULL OR status = $2)
    AND ($3::integer IS NULL OR category_id = $3) AND ($4::integer IS NULL OR location_id = $4)
  ORDER BY report_id DESC LIMIT $5 OFFSET $6`;
const claimListSql =
  'SELECT claim_id, report_id, user_id, evidence, status, claim_date, updated_at FROM claims WHERE user_id = $1 ORDER BY claim_id DESC LIMIT $2 OFFSET $3';

type PlanNode = {
  'Node Type': string;
  'Index Name'?: string;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Rows Removed by Filter'?: number;
  Plans?: PlanNode[];
};
type Explain = { Plan: PlanNode; 'Execution Time': number };
const fixture = isolatedDatabase();
const pool = fixture.pool;
const flatten = (plan: PlanNode): PlanNode[] => [
  plan,
  ...(plan.Plans ?? []).flatMap(flatten),
];

async function explain(sql: string, values: unknown[]) {
  const result = await pool.query<{ 'QUERY PLAN': Explain[] }>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
    values,
  );
  const output = result.rows[0]?.['QUERY PLAN'][0];
  if (!output) throw new Error('PostgreSQL returned no query plan');
  return output;
}
function summary(plan: Explain) {
  const nodes = flatten(plan.Plan);
  return {
    executionMs: plan['Execution Time'],
    sharedBlocks:
      (plan.Plan['Shared Hit Blocks'] ?? 0) +
      (plan.Plan['Shared Read Blocks'] ?? 0),
    indexes: nodes.flatMap((node) =>
      node['Index Name'] ? [node['Index Name']] : [],
    ),
    sortNodes: nodes.filter((node) => node['Node Type'].includes('Sort'))
      .length,
    rowsRemovedByFilter: nodes.reduce(
      (sum, node) => sum + (node['Rows Removed by Filter'] ?? 0),
      0,
    ),
  };
}

beforeAll(async () => {
  await fixture.open();
  await migrate(pool);
  // Synthetic scale fixture only: 500 users, 40k historical reports, 80k claims.
  // Open reports are sparse to exercise a filtered historical feed; no real data.
  await pool.query(`INSERT INTO users (name,email,password_hash)
    SELECT 'Synthetic user ' || g, 'benchmark-' || g || '@example.test', 'unused benchmark hash'
    FROM generate_series(1,500) AS g`);
  await pool.query(
    "INSERT INTO categories (category_name) VALUES ('Synthetic category')",
  );
  await pool.query(
    "INSERT INTO locations (location_name) VALUES ('Synthetic location')",
  );
  await pool.query(
    `INSERT INTO item_reports (user_id,category_id,location_id,type,title,event_datetime,status)
    SELECT (g % 500)+1, 1, 1, CASE WHEN g % 2 = 0 THEN 'LOST' ELSE 'FOUND' END,
      'Synthetic report ' || g, $1::timestamptz,
      CASE WHEN g % 100 = 1 THEN 'OPEN' WHEN g % 3 = 0 THEN 'RESOLVED' ELSE 'CLOSED' END
    FROM generate_series(1,40000) AS g`,
    ['2026-01-01T00:00:00Z'],
  );
  await pool.query(`INSERT INTO claims (report_id,user_id,evidence)
    SELECT (g % 40000)+1, (g % 500)+1, 'Synthetic benchmark evidence'
    FROM generate_series(1,80000) AS g`);
  // Recreate the previous index layout inside this disposable schema only.
  await pool.query('DROP INDEX claims_user_claim_idx');
  await pool.query('CREATE INDEX claims_user_idx ON claims (user_id)');
  await pool.query('DROP INDEX item_reports_type_status_report_idx');
  await pool.query('CREATE INDEX item_reports_type_idx ON item_reports (type)');
  await pool.query('ANALYZE users');
  await pool.query('ANALYZE item_reports');
  await pool.query('ANALYZE claims');
});
afterAll(() => fixture.close());

it('uses composite indexes for the actual parameterized list queries without forcing planner settings', async () => {
  const reportValues = ['FOUND', 'OPEN', null, null, 20, 0];
  const claimValues = [13, 20, 0];
  const beforeReports = await pool.query<{ report_id: number }>(
    reportListSql,
    reportValues,
  );
  const beforeClaims = await pool.query<{ claim_id: number }>(
    claimListSql,
    claimValues,
  );
  const before = {
    reports: summary(await explain(reportListSql, reportValues)),
    claims: summary(await explain(claimListSql, claimValues)),
  };

  await pool.query(
    'CREATE INDEX claims_user_claim_idx ON claims (user_id, claim_id DESC)',
  );
  await pool.query('DROP INDEX claims_user_idx');
  await pool.query(
    'CREATE INDEX item_reports_type_status_report_idx ON item_reports (type,status,report_id DESC)',
  );
  await pool.query('DROP INDEX item_reports_type_idx');
  await pool.query('ANALYZE item_reports');
  await pool.query('ANALYZE claims');

  const after = {
    reports: summary(await explain(reportListSql, reportValues)),
    claims: summary(await explain(claimListSql, claimValues)),
  };
  expect(after.reports.indexes).toContain(
    'item_reports_type_status_report_idx',
  );
  expect(after.claims.indexes).toContain('claims_user_claim_idx');
  expect(after.claims.sortNodes).toBe(0);
  expect(
    (
      await pool.query<{ report_id: number }>(reportListSql, reportValues)
    ).rows.map((row) => row.report_id),
  ).toEqual(beforeReports.rows.map((row) => row.report_id));
  expect(
    (
      await pool.query<{ claim_id: number }>(claimListSql, claimValues)
    ).rows.map((row) => row.claim_id),
  ).toEqual(beforeClaims.rows.map((row) => row.claim_id));
  // Do not assert wall-clock ratios: cache state/hardware vary. Retain observed evidence.
  mkdirSync('tmp', { recursive: true });
  writeFileSync(
    'tmp/database-index-plans.json',
    JSON.stringify(
      { fixture: { users: 500, reports: 40000, claims: 80000 }, before, after },
      null,
      2,
    ),
  );
});
