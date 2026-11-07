export type AccountNotification = {
  notificationId: number;
  kind: 'PROFILE_UPDATED' | 'AVATAR_UPDATED';
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
