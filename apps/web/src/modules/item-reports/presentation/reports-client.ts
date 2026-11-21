import { z } from 'zod';
import type { ReportPatch } from '../domain/report';

const id = z.number().int().positive();
const reportSchema = z.object({
  reportId: id,
  categoryId: id,
  locationId: id,
  type: z.enum(['LOST', 'FOUND']),
  title: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  eventDatetime: z.iso.datetime({ offset: true }),
  status: z.enum(['OPEN', 'RESOLVED', 'CLOSED']),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
const categorySchema = z.object({ categoryId: id, categoryName: z.string() });
const locationSchema = z.object({ locationId: id, locationName: z.string() });
export type ReportType = z.infer<typeof reportSchema>['type'];
type ReportRecord = z.infer<typeof reportSchema>;
export type ReportRow = ReportRecord & {
  categoryName: string;
  locationName: string;
};
export const REPORT_PAGE_SIZE = 10;

export class ReportRequestError extends Error {
  constructor(public readonly status: number) {
    super('Report request failed');
  }
}
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  patch?: ReportPatch | { status: 'CLOSED' },
) {
  const response = await fetch(`/api/v1/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    ...(patch && {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  });
  if (!response.ok) throw new ReportRequestError(response.status);
  const parsed = z.object({ data: schema }).safeParse(await response.json());
  if (!parsed.success) throw new ReportRequestError(503);
  return parsed.data.data;
}
// Catalogs are paginated too; do not lose names after their first page.
async function catalog<T>(
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await request(
      `${path}?limit=100&offset=${offset}`,
      z.array(schema),
      signal,
    );
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}
export async function loadReportCatalogs(signal: AbortSignal) {
  const [categories, locations] = await Promise.all([
    catalog('categories', categorySchema, signal),
    catalog('locations', locationSchema, signal),
  ]);
  return { categories, locations };
}
async function names(signal: AbortSignal) {
  const { categories, locations } = await loadReportCatalogs(signal);
  return {
    categories: new Map(
      categories.map((row) => [row.categoryId, row.categoryName]),
    ),
    locations: new Map(
      locations.map((row) => [row.locationId, row.locationName]),
    ),
  };
}
export type ReportOption = { id: number; name: string };
export async function loadReportOptions(signal: AbortSignal) {
  const { categories, locations } = await loadReportCatalogs(signal);
  return {
    categories: categories.map((row): ReportOption => ({
      id: row.categoryId,
      name: row.categoryName,
    })),
    locations: locations.map((row): ReportOption => ({
      id: row.locationId,
      name: row.locationName,
    })),
  };
}
function describe(
  row: z.infer<typeof reportSchema>,
  lookup: Awaited<ReturnType<typeof names>>,
): ReportRow {
  return {
    ...row,
    categoryName: lookup.categories.get(row.categoryId) ?? 'ไม่พบชื่อหมวดหมู่',
    locationName: lookup.locations.get(row.locationId) ?? 'ไม่พบชื่อสถานที่',
  };
}
export async function loadReportPage(
  type: ReportType,
  offset: number,
  signal: AbortSignal,
  options: { q?: string; owned?: boolean } = {},
) {
  const query = new URLSearchParams({
    type,
    limit: String(REPORT_PAGE_SIZE + 1),
    offset: String(offset),
  });
  if (options.q) query.set('q', options.q);
  // Look ahead one row; the API does not provide a total count.
  const [rows, lookup] = await Promise.all([
    request(
      `item-reports${options.owned ? '/me' : ''}?${query}`,
      z.array(reportSchema),
      signal,
    ),
    names(signal),
  ]);
  if (rows.some((row) => row.type !== type)) throw new ReportRequestError(503);
  return {
    rows: rows.slice(0, REPORT_PAGE_SIZE).map((row) => describe(row, lookup)),
    hasNext: rows.length > REPORT_PAGE_SIZE,
  };
}
export async function loadReportDetail(reportId: number, signal: AbortSignal) {
  const [row, lookup] = await Promise.all([
    request(`item-reports/${reportId}`, reportSchema, signal),
    names(signal),
  ]);
  return describe(row, lookup);
}
export function updateReportDetails(
  reportId: number,
  fields: Pick<
    ReportRecord,
    'title' | 'description' | 'categoryId' | 'locationId'
  >,
  signal: AbortSignal,
) {
  return request(`item-reports/${reportId}`, reportSchema, signal, fields);
}
export function closeReport(reportId: number, signal: AbortSignal) {
  return request(`item-reports/${reportId}/status`, reportSchema, signal, {
    status: 'CLOSED',
  });
}
export type CreateReportInput = {
  type: ReportType;
  title: string;
  categoryId: number;
  locationId: number;
  eventDatetime: string;
  description?: string;
};
const createdSchema = z.object({ data: z.object({ reportId: id }) });
// Status 0 means the report may exist but its answer could not be read.
export async function createReport(
  input: CreateReportInput,
  signal: AbortSignal,
) {
  const response = await fetch('/api/v1/item-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(input),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!response.ok) throw new ReportRequestError(response.status);
  const parsed = createdSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) throw new ReportRequestError(0);
  return parsed.data.data.reportId;
}
export async function uploadReportImage(
  reportId: number,
  file: File,
  signal: AbortSignal,
) {
  const response = await fetch(`/api/v1/item-reports/${reportId}/image`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    credentials: 'same-origin',
    cache: 'no-store',
    body: file,
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  });
  if (!response.ok) throw new ReportRequestError(response.status);
}
export function reportImageHref(value: string | null): string | null {
  if (!value || /[\u0000-\u0020\\]/.test(value) || value.startsWith('//'))
    return null;
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}
