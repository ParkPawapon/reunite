import 'server-only';
import { query, type Sql } from '@campus/database';
import type {
  ProfileInput,
  ProfileRepository,
  StudentProfile,
} from '../domain/profile';

type Row = {
  user_id: number;
  name: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  student_id: string | null;
  faculty: string | null;
  department: string | null;
  major: string | null;
  phone: string | null;
  avatar_version: string | null;
};
const columns =
  'user_id, name, email, first_name, last_name, student_id, faculty, department, major, phone, avatar_version';
const map = (row: Row): StudentProfile => ({
  userId: row.user_id,
  name: row.name,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  studentId: row.student_id,
  faculty: row.faculty,
  department: row.department,
  major: row.major,
  phone: row.phone,
  avatarVersion: row.avatar_version,
});

export class PgProfileRepository implements ProfileRepository {
  constructor(private readonly db: Sql) {}
  async get(userId: number) {
    const [row] = await query<Row>(
      this.db,
      `SELECT ${columns} FROM users WHERE user_id=$1`,
      [userId],
    );
    return row ? map(row) : null;
  }
  async credentials(userId: number) {
    const [row] = await query<{ email: string; password_hash: string }>(
      this.db,
      'SELECT email, password_hash FROM users WHERE user_id=$1',
      [userId],
    );
    return row ? { email: row.email, hash: row.password_hash } : null;
  }
  async update(userId: number, input: ProfileInput, expectedHash: string) {
    // One SQL statement makes the change and its notification atomic.
    const [row] = await query<Row>(
      this.db,
      `WITH changed AS (
      UPDATE users SET name=$2, first_name=$3, last_name=$4, email=$5,
        student_id=$6, faculty=$7, department=$8, major=$9, phone=$10
      WHERE user_id=$1 AND password_hash=$11
        AND ROW(first_name,last_name,email,student_id,faculty,department,major,phone)
          IS DISTINCT FROM ROW($3::varchar,$4::varchar,$5::varchar,$6::varchar,$7::varchar,$8::varchar,$9::varchar,$10::varchar)
      RETURNING ${columns}
    ), activity AS (
      INSERT INTO notifications (user_id,kind) SELECT user_id,'PROFILE_UPDATED' FROM changed
    ) SELECT ${columns} FROM changed UNION ALL
      SELECT ${columns} FROM users WHERE user_id=$1 AND password_hash=$11 AND NOT EXISTS (SELECT 1 FROM changed)`,
      [
        userId,
        `${input.firstName} ${input.lastName}`,
        input.firstName,
        input.lastName,
        input.email,
        input.studentId,
        input.faculty,
        input.department,
        input.major,
        input.phone,
        expectedHash,
      ],
    );
    return row ? map(row) : null;
  }
  async setAvatar(
    userId: number,
    data: Uint8Array | null,
    version: string | null,
  ) {
    await query(
      this.db,
      `WITH changed AS (
      UPDATE users SET avatar_data=$2, avatar_version=$3 WHERE user_id=$1 AND avatar_version IS DISTINCT FROM $3::varchar
      RETURNING user_id
    ) INSERT INTO notifications (user_id,kind) SELECT user_id,'AVATAR_UPDATED' FROM changed`,
      [userId, data ? Buffer.from(data) : null, version],
    );
  }
  async avatar(userId: number) {
    const [row] = await query<{ avatar_data: Buffer | null }>(
      this.db,
      'SELECT avatar_data FROM users WHERE user_id=$1',
      [userId],
    );
    return row?.avatar_data ?? null;
  }
}
