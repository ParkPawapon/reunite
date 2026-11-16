import { z } from 'zod';

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
export type ReportRow = z.infer<typeof reportSchema> & {
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
) {
  const response = await fetch(`/api/v1/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
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
async function names(signal: AbortSignal) {
  const [categories, locations] = await Promise.all([
    catalog('categories', categorySchema, signal),
    catalog('locations', locationSchema, signal),
  ]);
  return {
    categories: new Map(
      categories.map((row) => [row.categoryId, row.categoryName]),
    ),
    locations: new Map(
      locations.map((row) => [row.locationId, row.locationName]),
    ),
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
) {
  // Look ahead one row; the API does not provide a total count.
  const [rows, lookup] = await Promise.all([
    request(
      `item-reports?type=${type}&limit=${REPORT_PAGE_SIZE + 1}&offset=${offset}`,
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
