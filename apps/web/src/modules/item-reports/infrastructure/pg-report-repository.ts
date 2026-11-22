import 'server-only';
import { query, type Sql } from '@campus/database';
import type {
  Report,
  ReportRepository,
  ReportInput,
  ReportFilter,
  ReportBrowse,
  ReportPatch,
} from '../domain/report';

type Row = {
  report_id: number;
  user_id: number;
  category_id: number;
  location_id: number;
  type: Report['type'];
  title: string;
  description: string | null;
  image: string | null;
  event_datetime: Date;
  status: Report['status'];
  created_at: Date;
  updated_at: Date;
};
const columns =
  'report_id, user_id, category_id, location_id, type, title, description, image, event_datetime, status, created_at, updated_at';
const map = (row: Row): Report => ({
  reportId: row.report_id,
  userId: row.user_id,
  categoryId: row.category_id,
  locationId: row.location_id,
  type: row.type,
  title: row.title,
  description: row.description,
  image: row.image,
  eventDatetime: row.event_datetime.toISOString(),
  status: row.status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export class PgReportRepository implements ReportRepository {
  constructor(private readonly db: Sql) {}

  async list(filter: ReportFilter): Promise<Report[]> {
    const rows = await query<Row>(
      this.db,
      `SELECT ${columns} FROM item_reports
      WHERE ($1::varchar IS NULL OR type = $1)
      AND ($2::varchar IS NULL OR status = $2)
      AND ($3::integer IS NULL OR category_id = $3)
      AND ($4::integer IS NULL OR location_id = $4)
      AND ($7::text IS NULL OR strpos(lower(title), lower($7::text)) > 0)
      ORDER BY report_id DESC LIMIT $5 OFFSET $6`,
      [
        filter.type ?? null,
        filter.status ?? null,
        filter.categoryId ?? null,
        filter.locationId ?? null,
        filter.limit,
        filter.offset,
        filter.q || null,
      ],
    );
    return rows.map(map);
  }

  async find(id: number): Promise<Report | null> {
    const [row] = await query<Row>(
      this.db,
      `SELECT ${columns} FROM item_reports WHERE report_id = $1`,
      [id],
    );
    return row ? map(row) : null;
  }

  async create(userId: number, input: ReportInput) {
    const [row] = await query<Row>(
      this.db,
      `INSERT INTO item_reports
      (user_id, category_id, location_id, type, title, description, image, event_datetime)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${columns}`,
      [
        userId,
        input.categoryId,
        input.locationId,
        input.type,
        input.title,
        input.description ?? null,
        input.image ?? null,
        input.eventDatetime,
      ],
    );
    if (!row) throw new Error('Report insert returned no row');
    return map(row);
  }
  async updateOwned(id: number, userId: number, patch: ReportPatch) {
    // Explicit booleans distinguish missing nullable fields from an intentional null.
    const [row] = await query<Row>(
      this.db,
      `UPDATE item_reports SET
      title = CASE WHEN $3::boolean THEN $4::varchar ELSE title END,
      description = CASE WHEN $5::boolean THEN $6::text ELSE description END,
      image = CASE WHEN $7::boolean THEN $8::varchar ELSE image END,
      image_data = CASE WHEN $7::boolean THEN NULL ELSE image_data END,
      category_id = CASE WHEN $9::boolean THEN $10::integer ELSE category_id END,
      location_id = CASE WHEN $11::boolean THEN $12::integer ELSE location_id END,
      event_datetime = COALESCE($13::timestamptz, event_datetime)
      WHERE report_id = $1 AND user_id = $2 RETURNING ${columns}`,
      [
        id,
        userId,
        patch.title !== undefined,
        patch.title ?? null,
        patch.description !== undefined,
        patch.description ?? null,
        patch.image !== undefined,
        patch.image ?? null,
        patch.categoryId !== undefined,
        patch.categoryId ?? null,
        patch.locationId !== undefined,
        patch.locationId ?? null,
        patch.eventDatetime ?? null,
      ],
    );
    return row ? map(row) : null;
  }
  async updateStatusOwned(
    id: number,
    userId: number,
    status: 'RESOLVED' | 'CLOSED',
  ): Promise<Report | null> {
    const [row] = await query<Row>(
      this.db,
      `UPDATE item_reports
      SET status = $3, updated_at = NOW()
      WHERE report_id = $1 AND user_id = $2 AND status = 'OPEN'
      RETURNING report_id, user_id, category_id, location_id, type, title,
          description, image, event_datetime, status, created_at, updated_at`,
      [id, userId, status],
    );
    return row ? map(row) : null;
  }
  async listOwned(userId: number, filter: ReportBrowse): Promise<Report[]> {
    const rows = await query<Row>(
      this.db,
      `SELECT ${columns} FROM item_reports
      WHERE user_id = $1
      AND ($4::varchar IS NULL OR type = $4)
      AND ($5::text IS NULL OR strpos(lower(title), lower($5::text)) > 0)
      AND ($6::varchar IS NULL OR status = $6)
      ORDER BY report_id DESC
      LIMIT $2 OFFSET $3`,
      [
        userId,
        filter.limit,
        filter.offset,
        filter.type ?? null,
        filter.q || null,
        filter.status ?? null,
      ],
    );
    return rows.map(map);
  }
}
