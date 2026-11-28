import { Pool } from 'pg';
import { z } from 'zod';
import { databaseConfig } from '../src/config';

try {
  const { DB_STORAGE_LIMIT_MIB, DB_STORAGE_ALERT_PERCENT } = z
    .object({
      DB_STORAGE_LIMIT_MIB: z.coerce.number().positive().finite(),
      DB_STORAGE_ALERT_PERCENT: z.coerce.number().min(1).max(100).default(80),
    })
    .parse(process.env);
  const pool = new Pool(databaseConfig({ ...process.env, DB_POOL_MAX: '1' }));
  try {
    const { rows } = await pool.query<{ used: string }>(
      'SELECT pg_database_size(current_database())::text AS used',
    );
    const used = Number(rows[0]?.used);
    if (!Number.isSafeInteger(used) || used <= 0)
      throw new Error('Missing storage metrics');
    const usedMiB = used / 1048576;
    const percent = (usedMiB / DB_STORAGE_LIMIT_MIB) * 100;
    const alert = percent >= DB_STORAGE_ALERT_PERCENT;
    console.info(
      JSON.stringify({
        usedMiB: Number(usedMiB.toFixed(2)),
        limitMiB: DB_STORAGE_LIMIT_MIB,
        percent: Number(percent.toFixed(2)),
        alertAtPercent: DB_STORAGE_ALERT_PERCENT,
        alert,
      }),
    );
    if (alert) process.exitCode = 1;
  } finally {
    await pool.end();
  }
} catch {
  console.error(
    'Storage check failed. Verify DB access, TLS and storage limits.',
  );
  process.exitCode = 2;
}
