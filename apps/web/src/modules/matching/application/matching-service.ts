import { AppError } from '@campus/shared';
import type { MatchReader } from '../domain/match-reader';
export class MatchingService {
  constructor(private readonly reader: MatchReader) {}
  list(userId: number, before?: number) {
    return this.reader.listOwned(userId, before);
  }
  async reportStatus(userId: number, reportId: number) {
    const status = await this.reader.reportStatus(userId, reportId);
    if (!status) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return status;
  }
}
