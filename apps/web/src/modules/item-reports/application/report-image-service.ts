import { AppError } from '@campus/shared';
import type { ReportImageRepository } from '../domain/report-image';
export class ReportImageService {
  constructor(private readonly repository: ReportImageRepository) {}
  async ownedInfo(reportId: number, userId: number) {
    const info = await this.repository.ownedInfo(reportId, userId);
    if (!info) throw new AppError('NOT_FOUND', 404, 'Report unavailable');
    return info;
  }
  async requireOwner(reportId: number, userId: number) {
    if (!(await this.repository.owns(reportId, userId)))
      throw new AppError('NOT_FOUND', 404, 'Report unavailable');
  }
  async get(reportId: number) {
    const image = await this.repository.get(reportId);
    if (!image) throw new AppError('NOT_FOUND', 404, 'No item image');
    return image;
  }
  async set(reportId: number, userId: number, data: Uint8Array | null) {
    if (!(await this.repository.setOwned(reportId, userId, data)))
      throw new AppError('NOT_FOUND', 404, 'Report unavailable');
    return { updated: true };
  }
}
