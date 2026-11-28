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
export type ReportPublisher = {
  name: string | null;
  email: string;
  phone: string | null;
};

export function reportPublisher(account: ReportPublisher): ReportPublisher {
  const name = account.name?.trim();
  // Microsoft sign-in can store a username as the account name.
  return {
    name: name && !/^\S+@\S+$/u.test(name) ? name : null,
    email: account.email,
    phone: account.phone?.trim() || null,
  };
}

export type ReportDetail = Report & { publisher: ReportPublisher };
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
  find(id: number): Promise<ReportDetail | null>;
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
