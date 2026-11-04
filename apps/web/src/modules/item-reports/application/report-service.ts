import { AppError } from '@campus/shared';
import type {
  ReportRepository,
  ReportInput,
  ReportPatch,
  ReportFilter,
} from '../domain/report';

export class ReportService {
  constructor(private readonly repository: ReportRepository) {}
  list(filter: ReportFilter) {
    return this.repository.list(filter);
  }
  async find(id: number) {
    const report = await this.repository.find(id);
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return report;
  }
  create(userId: number, input: ReportInput) {
    return this.repository.create(userId, input);
  }
  async update(id: number, userId: number, patch: ReportPatch) {
    const existing = await this.find(id);
    if (existing.userId !== userId)
      throw new AppError('NOT_FOUND', 404, 'Report not found');
    const report = await this.repository.updateOwned(id, userId, patch);
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return report;
  }
}
