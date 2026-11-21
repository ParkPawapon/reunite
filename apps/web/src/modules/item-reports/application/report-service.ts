import { AppError } from '@campus/shared';
import type {
  Report,
  ReportRepository,
  ReportInput,
  ReportPatch,
  ReportFilter,
  ReportBrowse,
} from '../domain/report';

export class ReportService {
  constructor(private readonly repository: ReportRepository) {}

  list(filter: ReportFilter): Promise<Report[]> {
    return this.repository.list(filter);
  }

  async find(id: number): Promise<Report> {
    const report = await this.repository.find(id);
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return report;
  }

  create(userId: number, input: ReportInput) {
    return this.repository.create(userId, input);
  }
  async update(id: number, userId: number, patch: ReportPatch) {
    const report = await this.repository.updateOwned(id, userId, patch);
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return report;
  }

  async updateStatus(
    id: number,
    userId: number,
    status: 'RESOLVED' | 'CLOSED',
  ): Promise<Report> {
    const report = await this.repository.updateStatusOwned(id, userId, status);
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report not found');
    return report;
  }

  listOwned(userId: number, filter: ReportBrowse): Promise<Report[]> {
    return this.repository.listOwned(userId, filter);
  }
}
