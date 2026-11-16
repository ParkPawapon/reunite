import 'server-only';
import { query, type Sql } from '@campus/database';
import type { ReportImageRepository } from '../domain/report-image';
export class PgReportImageRepository implements ReportImageRepository {
  constructor(private readonly db: Sql) {}
  async ownedInfo(reportId: number, userId: number) {
    const [row] = await query<{ has_image: boolean }>(
      this.db,
      'SELECT image_data IS NOT NULL AS has_image FROM item_reports WHERE report_id=$1 AND user_id=$2',
      [reportId, userId],
    );
    return row ? { hasImage: row.has_image } : null;
  }
  async owns(reportId: number, userId: number) {
    return (
      (
        await query(
          this.db,
          'SELECT 1 FROM item_reports WHERE report_id=$1 AND user_id=$2',
          [reportId, userId],
        )
      ).length === 1
    );
  }
  async get(reportId: number) {
    const [row] = await query<{ image_data: Buffer | null }>(
      this.db,
      'SELECT image_data FROM item_reports WHERE report_id=$1',
      [reportId],
    );
    return row?.image_data ?? null;
  }
  async setOwned(reportId: number, userId: number, data: Uint8Array | null) {
    const path = data ? `/api/v1/item-reports/${reportId}/image` : null;
    return (
      (
        await query(
          this.db,
          'UPDATE item_reports SET image_data=$3,image=$4 WHERE report_id=$1 AND user_id=$2 RETURNING report_id',
          [reportId, userId, data ? Buffer.from(data) : null, path],
        )
      ).length === 1
    );
  }
}
