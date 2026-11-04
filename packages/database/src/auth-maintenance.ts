import 'server-only';
import type { Pool } from 'pg';
import { withTransaction } from './transaction';

export type AuthCleanupOptions = { apply?: boolean; batchSize?: number };

/** Remove only expired technical authentication state, never business records. */
export async function cleanupExpiredAuth(
  pool: Pool,
  options: AuthCleanupOptions = {},
) {
  const batchSize = options.batchSize ?? 1000;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10000) {
    throw new RangeError(
      'Cleanup batch size must be an integer from 1 to 10000',
    );
  }
  return withTransaction(pool, async (client) => {
    if (!options.apply) {
      const sessions = await client.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM (
        SELECT token_hash FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP
        ORDER BY expires_at LIMIT $1
      ) AS expired`,
        [batchSize],
      );
      const throttles = await client.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM (
        SELECT key_hash FROM auth_login_throttles WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        ORDER BY window_start LIMIT $1
      ) AS expired`,
        [batchSize],
      );
      return {
        mode: 'dry-run' as const,
        sessions: sessions.rows[0]?.count ?? 0,
        loginThrottles: throttles.rows[0]?.count ?? 0,
        batchSize,
      };
    }
    const sessions = await client.query(
      `WITH expired AS (
      SELECT token_hash FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP
      ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED
    ) DELETE FROM auth_sessions AS sessions USING expired
      WHERE sessions.token_hash = expired.token_hash AND sessions.expires_at <= CURRENT_TIMESTAMP`,
      [batchSize],
    );
    const throttles = await client.query(
      `WITH expired AS (
      SELECT key_hash FROM auth_login_throttles WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
      ORDER BY window_start LIMIT $1 FOR UPDATE SKIP LOCKED
    ) DELETE FROM auth_login_throttles AS throttles USING expired
      WHERE throttles.key_hash = expired.key_hash AND throttles.window_start < CURRENT_TIMESTAMP - INTERVAL '15 minutes'`,
      [batchSize],
    );
    return {
      mode: 'apply' as const,
      sessions: sessions.rowCount ?? 0,
      loginThrottles: throttles.rowCount ?? 0,
      batchSize,
    };
  });
}
