import { AppError } from '@campus/shared';
import type {
  ReportImageDeleteSlot,
  ReportImageRepository,
  ReportImageWriteSlot,
} from '../domain/report-image';
import { reportImageSlotHref } from '../domain/report-image-policy';

export class ReportImageService {
  constructor(private readonly repository: ReportImageRepository) {}
  async ownedInfo(reportId: number, userId: number) {
    const info = await this.repository.ownedInfo(reportId, userId);
    if (!info) throw new AppError('NOT_FOUND', 404, 'Report unavailable');
    return info;
  }
  async listImages(reportId: number) {
    const info = await this.repository.listPublicInfo(reportId);
    if (!info) throw new AppError('NOT_FOUND', 404, 'Report unavailable');
    return {
      imageCount: info.imageCount,
      images: info.slots.map((slot) => reportImageSlotHref(reportId, slot)),
    };
  }
  async requireOwner(reportId: number, userId: number) {
    if (!(await this.repository.owns(reportId, userId)))
      throw new AppError('NOT_FOUND', 404, 'Report unavailable');
  }
  async get(reportId: number, slot: 1 | 2 | 3 = 1) {
    const image = await this.repository.get(reportId, slot);
    if (!image) throw new AppError('NOT_FOUND', 404, 'No item image');
    return image;
  }
  async set(
    reportId: number,
    userId: number,
    data: Uint8Array | null,
    slot?: ReportImageWriteSlot | ReportImageDeleteSlot,
  ) {
    if (data === null) {
      const deleteSlot: ReportImageDeleteSlot =
        slot === 'all' || slot === 1 || slot === 2 || slot === 3 ? slot : 1;
      const updated = await this.repository.deleteOwned(
        reportId,
        userId,
        deleteSlot,
      );
      if (!updated) throw new AppError('NOT_FOUND', 404, 'Report unavailable');
      return { updated: true as const, ...updated };
    }
    const writeSlot: ReportImageWriteSlot =
      slot === 'next' || slot === 1 || slot === 2 || slot === 3 ? slot : 1;
    const updated = await this.repository.setOwned(
      reportId,
      userId,
      data,
      writeSlot,
    );
    if (!updated) throw new AppError('NOT_FOUND', 404, 'Report unavailable');
    if (updated === 'full')
      throw new AppError(
        'VALIDATION_ERROR',
        422,
        'Maximum 3 photos per report',
      );
    return { updated: true as const, ...updated };
  }
}
