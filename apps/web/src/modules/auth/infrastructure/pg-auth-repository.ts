import 'server-only';
import { query, type Sql } from '@campus/database';
import type { AuthRepository, Credentials } from '../domain/auth';
import type { UserProfile } from '../../users/domain/user';

type UserRow = { user_id: number; name: string; email: string };
const profile = (row: UserRow): UserProfile => ({
  userId: row.user_id,
  name: row.name,
  email: row.email,
});
export class PgAuthRepository implements AuthRepository {
  constructor(private readonly db: Sql) {}
  async consumeLoginAttempt(keyHash: string) {
    const [row] = await query<{ attempts: number }>(
      this.db,
      `INSERT INTO auth_login_throttles (key_hash, attempts) VALUES ($1, 1)
      ON CONFLICT (key_hash) DO UPDATE SET
        attempts = CASE WHEN auth_login_throttles.window_start < CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 1 ELSE LEAST(auth_login_throttles.attempts + 1, 11) END,
        window_start = CASE WHEN auth_login_throttles.window_start < CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP ELSE auth_login_throttles.window_start END
      RETURNING attempts`,
      [keyHash],
    );
    return row !== undefined && row.attempts <= 10;
  }
  async findCredentials(email: string): Promise<Credentials | null> {
    const [row] = await query<UserRow & { password_hash: string }>(
      this.db,
      'SELECT user_id, name, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    return row
      ? { profile: profile(row), passwordHash: row.password_hash }
      : null;
  }
  async createSession(hash: string, userId: number, expiresAt: Date) {
    await query(
      this.db,
      'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [hash, userId, expiresAt],
    );
  }
  async findSession(hash: string) {
    const [row] = await query<UserRow>(
      this.db,
      `SELECT u.user_id, u.name, u.email FROM auth_sessions s
      JOIN users u ON u.user_id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [hash],
    );
    return row ? profile(row) : null;
  }
  async revokeSession(hash: string) {
    await query(this.db, 'DELETE FROM auth_sessions WHERE token_hash = $1', [
      hash,
    ]);
  }
}
