import { AppError } from '@campus/shared';
import type {
  Report,
  ReportRepository,
  ReportInput,
  ReportPatch,
  ReportFilter,
} from '../domain/report';

export class ReportService {
  constructor(private readonly repository: ReportRepository) {}

  list(filter: ReportFilter): Promise<Report[]> {
    return this.repository.list(filter);
  }

  // BE006: replace placeholder with repository lookup and 404 NOT_FOUND check.
  async find(_id: number): Promise<Report> {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE006 is awaiting implementation',
    );
  }
  create(userId: number, input: ReportInput) {
    return this.repository.create(userId, input);
  }
  async update(id: number, userId: number, patch: ReportPatch) {
    const report = await this.repository.updateOwned(id, userId, patch);
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return report;
  }
}
