import 'server-only';
import { query, type Sql } from '@campus/database';
import type {
  ReportImageAccess,
  ReportImageDeleteSlot,
  ReportImageRepository,
  ReportImageWriteSlot,
} from '../domain/report-image';
import { MAX_REPORT_IMAGES } from '../domain/report-image-policy';

type SlotRow = {
  s1: boolean;
  s2: boolean;
  s3: boolean;
};

function toAccess(row: SlotRow): ReportImageAccess {
  const slots: number[] = [];
  if (row.s1) slots.push(1);
  if (row.s2) slots.push(2);
  if (row.s3) slots.push(3);
  return {
    hasImage: slots.length > 0,
    imageCount: slots.length,
    maxImages: MAX_REPORT_IMAGES,
    slots,
  };
}

export class PgReportImageRepository implements ReportImageRepository {
  constructor(private readonly db: Sql) {}
  async ownedInfo(reportId: number, userId: number) {
    const [row] = await query<SlotRow>(
      this.db,
      `SELECT
        image_data IS NOT NULL AS s1,
        image_data_2 IS NOT NULL AS s2,
        image_data_3 IS NOT NULL AS s3
      FROM item_reports WHERE report_id=$1 AND user_id=$2`,
      [reportId, userId],
    );
    return row ? toAccess(row) : null;
  }
  async listPublicInfo(reportId: number) {
    const [row] = await query<SlotRow>(
      this.db,
      `SELECT
        image_data IS NOT NULL AS s1,
        image_data_2 IS NOT NULL AS s2,
        image_data_3 IS NOT NULL AS s3
      FROM item_reports WHERE report_id=$1`,
      [reportId],
    );
    if (!row) return null;
    const access = toAccess(row);
    return { imageCount: access.imageCount, slots: access.slots };
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
  async get(reportId: number, slot: 1 | 2 | 3 = 1) {
    const column =
      slot === 2 ? 'image_data_2' : slot === 3 ? 'image_data_3' : 'image_data';
    const [row] = await query<{ data: Buffer | null }>(
      this.db,
      `SELECT ${column} AS data FROM item_reports WHERE report_id=$1`,
      [reportId],
    );
    return row?.data ?? null;
  }
  async setOwned(
    reportId: number,
    userId: number,
    data: Uint8Array,
    slot: ReportImageWriteSlot = 1,
  ) {
    const path = `/api/v1/item-reports/${reportId}/image`;
    const [row] = await query<SlotRow & { target_slot: number }>(
      this.db,
      `WITH current_slots AS (
        SELECT report_id,
          CASE
            WHEN $3::text = 'next' THEN
              CASE
                WHEN image_data IS NULL THEN 1
                WHEN image_data_2 IS NULL THEN 2
                WHEN image_data_3 IS NULL THEN 3
                ELSE 0
              END
            WHEN $3::text = '2' AND image_data IS NULL THEN 1
            WHEN $3::text = '3' AND image_data IS NULL THEN 1
            WHEN $3::text = '3' AND image_data_2 IS NULL THEN 2
            ELSE $3::integer
          END AS target_slot
        FROM item_reports
        WHERE report_id=$1 AND user_id=$2
        FOR UPDATE
      )
      UPDATE item_reports r
      SET
        image_data = CASE WHEN c.target_slot = 1 THEN $4::bytea ELSE r.image_data END,
        image_data_2 = CASE WHEN c.target_slot = 2 THEN $4::bytea ELSE r.image_data_2 END,
        image_data_3 = CASE WHEN c.target_slot = 3 THEN $4::bytea ELSE r.image_data_3 END,
        image = CASE WHEN c.target_slot BETWEEN 1 AND 3 THEN $5::varchar ELSE r.image END
      FROM current_slots c
      WHERE r.report_id = c.report_id
      RETURNING
        c.target_slot,
        r.image_data IS NOT NULL AS s1,
        r.image_data_2 IS NOT NULL AS s2,
        r.image_data_3 IS NOT NULL AS s3`,
      [reportId, userId, String(slot), Buffer.from(data), path],
    );
    if (!row) return null;
    if (row.target_slot === 0) return 'full';
    return toAccess(row);
  }
  async deleteOwned(
    reportId: number,
    userId: number,
    slot: ReportImageDeleteSlot = 1,
  ) {
    const path = `/api/v1/item-reports/${reportId}/image`;
    const [row] = await query<SlotRow>(
      this.db,
      `WITH current_row AS (
        SELECT report_id,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN $3::text <> '1' AND $3::text <> 'all' THEN image_data END,
            CASE WHEN $3::text <> '2' AND $3::text <> 'all' THEN image_data_2 END,
            CASE WHEN $3::text <> '3' AND $3::text <> 'all' THEN image_data_3 END
          ], NULL) AS kept
        FROM item_reports
        WHERE report_id=$1 AND user_id=$2
        FOR UPDATE
      )
      UPDATE item_reports r
      SET
        image_data = c.kept[1],
        image_data_2 = c.kept[2],
        image_data_3 = c.kept[3],
        image = CASE WHEN c.kept[1] IS NOT NULL THEN $4::varchar ELSE NULL END
      FROM current_row c
      WHERE r.report_id = c.report_id
      RETURNING
        r.image_data IS NOT NULL AS s1,
        r.image_data_2 IS NOT NULL AS s2,
        r.image_data_3 IS NOT NULL AS s3`,
      [reportId, userId, String(slot), path],
    );
    return row ? toAccess(row) : null;
  }
}
