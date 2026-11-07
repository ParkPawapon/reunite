import 'server-only';
import { query, type Sql } from '@campus/database';
import type {
  NotificationRepository,
  AccountNotification,
} from '../domain/notification';

type Row = {
  notification_id: number;
  kind: AccountNotification['kind'];
  created_at: Date;
  read_at: Date | null;
};
export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Sql) {}
  async list(userId: number, before?: number) {
    const [row] = await query<{ items: Row[]; unread_count: number }>(
      this.db,
      `SELECT
      (SELECT COUNT(*)::integer FROM notifications WHERE user_id=$1 AND read_at IS NULL) AS unread_count,
      COALESCE((SELECT json_agg(page) FROM (
        SELECT notification_id, kind, created_at, read_at FROM notifications
        WHERE user_id=$1 AND ($2::integer IS NULL OR notification_id < $2)
        ORDER BY notification_id DESC LIMIT 21
      ) page), '[]'::json) AS items`,
      [userId, before ?? null],
    );
    const items = (row?.items ?? []).slice(0, 20).map((item) => ({
      notificationId: item.notification_id,
      kind: item.kind,
      createdAt: new Date(item.created_at).toISOString(),
      readAt: item.read_at ? new Date(item.read_at).toISOString() : null,
    }));
    return {
      items,
      unreadCount: row?.unread_count ?? 0,
      nextCursor:
        (row?.items.length ?? 0) > 20
          ? (items.at(-1)?.notificationId ?? null)
          : null,
    };
  }
  async markRead(userId: number, throughId: number) {
    await query(
      this.db,
      `UPDATE notifications SET read_at=CURRENT_TIMESTAMP
      WHERE user_id=$1 AND read_at IS NULL AND notification_id <= $2`,
      [userId, throughId],
    );
  }
}
