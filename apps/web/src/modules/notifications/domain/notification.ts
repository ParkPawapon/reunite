export type AccountNotification = {
  notificationId: number;
  kind:
    | 'PROFILE_UPDATED'
    | 'AVATAR_UPDATED'
    | 'MATCH_SUGGESTED'
    | 'MATCH_PARTNER_CONFIRMED'
    | 'MATCH_RETURNED';
  matchId?: number;
  createdAt: string;
  readAt: string | null;
};
export interface NotificationRepository {
  list(
    userId: number,
    before?: number,
  ): Promise<{
    items: AccountNotification[];
    unreadCount: number;
    nextCursor: number | null;
  }>;
  markRead(userId: number, throughId: number): Promise<void>;
}
