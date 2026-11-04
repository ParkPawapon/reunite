import 'server-only';
import { Pool } from 'pg';
import { databaseConfig } from './config';

const state = globalThis as typeof globalThis & { campusPool?: Pool };
export function getPool(): Pool {
  if (!state.campusPool) {
    const pool = new Pool(databaseConfig());
    // Consume idle-client errors. Request handlers report sanitized failures separately.
    pool.on('error', () =>
      process.stderr.write(
        '{"level":"error","event":"database_idle_client_error"}\n',
      ),
    );
    state.campusPool = pool;
  }
  return state.campusPool;
}
export async function closePool() {
  const pool = state.campusPool;
  delete state.campusPool;
  await pool?.end();
}
