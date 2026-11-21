import { getPool } from '@campus/database';
import {
  matchingConfig,
  MATCHING_MODEL,
  CLOUDFLARE_MATCHING_MODEL,
  MATCHING_RESERVATION_USD_MICROS,
} from '../apps/web/src/config/matching';
const pool = getPool();
try {
  const config = matchingConfig();
  const totals = await pool.query<{
    reserved: string;
    estimated: string;
    free_attempts: number;
  }>(`SELECT
    COALESCE(sum(reserved_usd_micros),0)::text AS reserved,
    COALESCE(sum(estimated_usd_micros),0)::text AS estimated,
    COALESCE(sum(free_attempts_today) FILTER (WHERE free_quota_day=(statement_timestamp() AT TIME ZONE 'UTC')::date), 0)::integer AS free_attempts
    FROM report_matches`);
  const counts = await pool.query<{ state: string; count: number }>(
    'SELECT state,count(*)::integer AS count FROM report_matches GROUP BY state ORDER BY state',
  );
  const reserved = Number(totals.rows[0]?.reserved ?? 0);
  process.stdout.write(
    `${JSON.stringify(
      {
        enabled: config.enabled,
        keyConfigured: !!config.apiKey,
        provider: config.provider,
        model:
          config.provider === 'cloudflare'
            ? CLOUDFLARE_MATCHING_MODEL
            : MATCHING_MODEL,
        ...(config.provider === 'cloudflare' && {
          freeDailyLimit: config.freeDailyLimit,
          freeAttemptsToday: totals.rows[0]?.free_attempts ?? 0,
        }),
        budgetUsd: config.budgetUsdMicros / 1_000_000,
        reservedUsd: reserved / 1_000_000,
        estimatedCompletedCostUsd:
          Number(totals.rows[0]?.estimated ?? 0) / 1_000_000,
        remainingReservedCalls: Math.max(
          0,
          Math.floor(
            (config.budgetUsdMicros - reserved) /
              MATCHING_RESERVATION_USD_MICROS,
          ),
        ),
        jobs: counts.rows,
      },
      null,
      2,
    )}\n`,
  );
} catch {
  process.stderr.write(
    'Matching status unavailable; verify environment and applied migrations.\n',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
