import type { Page, ReportType, ReportStatus } from '@campus/shared';

export const REPORT_TITLE_LIMIT = 255;

export type ReportInput = {
  categoryId: number;
  locationId: number;
  type: ReportType;
  title: string;
  description?: string | null;
  image?: string | null;
  eventDatetime: string;
};
export type ReportPatch = Partial<
  Pick<
    ReportInput,
    | 'title'
    | 'description'
    | 'image'
    | 'categoryId'
    | 'locationId'
    | 'eventDatetime'
  >
>;
export type Report = Omit<ReportInput, 'description' | 'image'> & {
  reportId: number;
  userId: number;
  description: string | null;
  image: string | null;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
};
export type ReportBrowse = Page & {
  type?: ReportType;
  q?: string;
  status?: ReportStatus;
};
export type ReportFilter = ReportBrowse & {
  categoryId?: number;
  locationId?: number;
};
export interface ReportRepository {
  list(filter: ReportFilter): Promise<Report[]>;
  find(id: number): Promise<Report | null>;
  create(userId: number, input: ReportInput): Promise<Report>;
  updateOwned(
    id: number,
    userId: number,
    patch: ReportPatch,
  ): Promise<Report | null>;
  updateStatusOwned(
    id: number,
    userId: number,
    status: 'RESOLVED' | 'CLOSED',
  ): Promise<Report | null>;
  listOwned(userId: number, filter: ReportBrowse): Promise<Report[]>;
}
