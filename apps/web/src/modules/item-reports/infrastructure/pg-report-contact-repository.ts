import 'server-only';
import { query, type Sql } from '@campus/database';
import { AppError } from '@campus/shared';

export type ContactPreferences = { shareEmail: boolean; sharePhone: boolean };

export class PgReportContactRepository {
  constructor(private readonly db: Sql) {}

  async read(reportId: number, viewerId: number, matchId?: number) {
    const [row] = await query<{
      own: boolean;
      share_contact_email: boolean;
      share_contact_phone: boolean;
      email: string | null;
      phone: string | null;
    }>(
      this.db,
      `WITH report AS (
        SELECT r.user_id, r.share_contact_email, r.share_contact_phone, r.user_id = $2 AS own,
          r.status = 'OPEN' AND (r.user_id = $2 OR CASE WHEN $3::integer IS NULL THEN
            r.type = 'FOUND' AND EXISTS (
              SELECT 1 FROM claims c WHERE c.report_id = r.report_id
                AND c.user_id = $2 AND c.status = 'APPROVED'
            ) ELSE EXISTS (
              SELECT 1 FROM report_matches m
              JOIN item_reports l ON l.report_id = m.lost_report_id
              JOIN item_reports f ON f.report_id = m.found_report_id
              WHERE m.match_id = $3 AND m.notified AND m.state = 'complete'
                AND m.result->>'decision' = 'possible_match' AND m.returned_at IS NULL
                AND l.type = 'LOST' AND l.status = 'OPEN' AND l.matching_revision = m.lost_revision
                AND f.type = 'FOUND' AND f.status = 'OPEN' AND f.matching_revision = m.found_revision
                AND l.user_id <> f.user_id
                AND ((l.report_id = r.report_id AND f.user_id = $2
                      AND (f.share_contact_email OR f.share_contact_phone))
                  OR (f.report_id = r.report_id AND l.user_id = $2
                      AND (l.share_contact_email OR l.share_contact_phone)))
            ) END) AS visible
        FROM item_reports r WHERE r.report_id = $1
      )
      SELECT r.own, r.share_contact_email, r.share_contact_phone,
        CASE WHEN r.visible AND r.share_contact_email THEN u.email END AS email,
        CASE WHEN r.visible AND r.share_contact_phone THEN NULLIF(btrim(u.phone),'') END AS phone
      FROM report r JOIN users u ON u.user_id = r.user_id`,
      [reportId, viewerId, matchId ?? null],
    );
    if (!row) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return {
      preferences: row.own
        ? {
            shareEmail: row.share_contact_email,
            sharePhone: row.share_contact_phone,
          }
        : null,
      email: row.email,
      phone: row.phone,
    };
  }

  async save(
    reportId: number,
    ownerId: number,
    preferences: ContactPreferences,
  ) {
    const [row] = await query<{ report_id: number }>(
      this.db,
      `UPDATE item_reports SET share_contact_email = $3, share_contact_phone = $4
        WHERE report_id = $1 AND user_id = $2
        RETURNING report_id`,
      [reportId, ownerId, preferences.shareEmail, preferences.sharePhone],
    );
    if (!row) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return preferences;
  }
}
