import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadReportPage,
  reportImageHref,
} from '@/modules/item-reports/presentation/reports-client';

const report = {
  reportId: 1,
  categoryId: 101,
  locationId: 1,
  type: 'LOST',
  title: 'Client contract fixture',
  description: null,
  image: null,
  status: 'OPEN',
  eventDatetime: '2026-11-12T03:00:00.000Z',
  createdAt: '2026-11-12T04:00:00.000Z',
  updatedAt: '2026-11-12T04:00:00.000Z',
};
function installTransport(rows: unknown[]) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      'http://localhost',
    );
    if (url.pathname.endsWith('/item-reports'))
      return Response.json({ data: rows });
    if (url.pathname.endsWith('/categories')) {
      const data =
        url.searchParams.get('offset') === '100'
          ? [{ categoryId: 101, categoryName: 'Category on the second page' }]
          : Array.from({ length: 100 }, (_, n) => ({
              categoryId: n + 1,
              categoryName: `Category ${n + 1}`,
            }));
      return Response.json({ data });
    }
    if (url.pathname.endsWith('/locations'))
      return Response.json({
        data: [{ locationId: 1, locationName: 'Location fixture' }],
      });
    return new Response(null, { status: 503 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('report board transport', () => {
  it('resolves a name beyond the first catalog page and preserves look-ahead pagination', async () => {
    const fetchMock = installTransport(
      Array.from({ length: 11 }, (_, n) => ({ ...report, reportId: 11 - n })),
    );
    const page = await loadReportPage('LOST', 20, new AbortController().signal);
    expect(page.hasNext).toBe(true);
    expect(page.rows).toHaveLength(10);
    expect(page.rows[0]).toMatchObject({
      reportId: 11,
      categoryName: 'Category on the second page',
      locationName: 'Location fixture',
    });
    expect(page).not.toHaveProperty('total');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/v1/categories?limit=100&offset=100',
    );
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/v1/item-reports?type=LOST&limit=11&offset=20',
    );
  });
  it.each([
    { ...report, type: 'FOUND' },
    { ...report, reportId: 'invalid' },
  ])(
    'rejects a wrong-type or malformed report rather than mixing tabs',
    async (row) => {
      installTransport([row]);
      await expect(
        loadReportPage('LOST', 0, new AbortController().signal),
      ).rejects.toThrow('Report request failed');
    },
  );
});

describe('public report image references', () => {
  it.each([
    ['javascript:alert(1)', null],
    ['//example.test/image.png', null],
    ['/\\example.test/image.png', null],
    ['https://user:secret@example.test/image.png', null],
    ['/images/item.webp', '/images/item.webp'],
    ['https://example.test/item.webp', 'https://example.test/item.webp'],
  ])('validates a reference before offering a link: %s', (input, expected) => {
    expect(reportImageHref(input)).toBe(expected);
  });
});
