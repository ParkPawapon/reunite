import 'server-only';
import { query, type Sql } from '@campus/database';
import type { Page } from '@campus/shared';
import type { Location, LocationRepository } from '../domain/location';

type Row = {
  location_id: number;
  location_name: string;
  detail: string | null;
};

export class PgLocationRepository implements LocationRepository {
  constructor(private readonly db: Sql) {}

  async list(page: Page): Promise<Location[]> {
    const rows = await query<Row>(
      this.db,
      `SELECT location_id, location_name, detail FROM locations
       ORDER BY location_id ASC LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    return rows.map((row) => ({
      locationId: row.location_id,
      locationName: row.location_name,
      detail: row.detail,
    }));
  }
}
