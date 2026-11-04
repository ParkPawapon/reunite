import type { Pool, PoolClient, QueryResultRow } from 'pg';

export type Sql = Pick<Pool | PoolClient, 'query'>;
export async function query<Row extends QueryResultRow>(
  db: Sql,
  text: string,
  values: unknown[] = [],
): Promise<Row[]> {
  const result = await db.query<Row>(text, values);
  return result.rows;
}
