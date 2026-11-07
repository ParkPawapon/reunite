import type { NotificationRepository } from '../domain/notification';

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}
  list(userId: number, before?: number) {
    return this.repository.list(userId, before);
  }
  async markRead(userId: number, throughId: number) {
    // Bound to the last item the client actually fetched, so arrivals are not silently read.
    await this.repository.markRead(userId, throughId);
  }
}
