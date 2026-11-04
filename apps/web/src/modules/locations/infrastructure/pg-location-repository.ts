import 'server-only';
import { query, type Sql } from '@campus/database';
import type { Page } from '@campus/shared';
import type { LocationRepository } from '../domain/location';

export class PgLocationRepository implements LocationRepository {
  constructor(private readonly db: Sql) {}
  async list(page: Page) {
    const rows = await query<{
      location_id: number;
      location_name: string;
      detail: string | null;
    }>(
      this.db,
      'SELECT location_id, location_name, detail FROM locations ORDER BY location_id ASC LIMIT $1 OFFSET $2',
      [page.limit, page.offset],
    );
    return rows.map((row) => ({
      locationId: row.location_id,
      locationName: row.location_name,
      detail: row.detail,
    }));
  }
}
