import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createReport,
  ReportRequestError,
  uploadReportImage,
} from '@/modules/item-reports/presentation/reports-client';
import {
  formatEventDate,
  formatEventDatetime,
  formatEventTime,
} from '@/components/item-reports/report-format';
import {
  PHOTO_MAX_BYTES,
  checkPhotos,
  formatSize,
  photoTypeLabel,
} from '@/components/item-reports/photo-rules';
import { emptyDraft } from '@/components/item-reports/report-draft';
import {
  toEventDatetime,
  validateReport,
} from '@/components/item-reports/report-validation';

const draft = {
  ...emptyDraft,
  title: '  ร่มพับสีกรมท่า  ',
  categoryId: '2',
  locationId: '3',
  date: '2026-11-16',
  time: '10:30',
};
const image = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type });

afterEach(() => vi.unstubAllGlobals());

describe('report form validation', () => {
  it('trims the title, drops an empty description and builds the payload', () => {
    expect(validateReport('LOST', draft)).toEqual({
      ok: true,
      payload: {
        type: 'LOST',
        title: 'ร่มพับสีกรมท่า',
        categoryId: 2,
        locationId: 3,
        eventDatetime: '2026-11-16T10:30:00+07:00',
      },
    });
    const result = validateReport('FOUND', {
      ...draft,
      description: '  สีน้ำเงิน  ',
    });
    expect(result.ok && result.payload).toMatchObject({
      type: 'FOUND',
      description: 'สีน้ำเงิน',
    });
  });
  it('requires title, category, location, date and time', () => {
    const result = validateReport('LOST', emptyDraft);
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      'categoryId',
      'date',
      'locationId',
      'time',
      'title',
    ]);
  });
  it('words the place error for the active tab', () => {
    const lost = validateReport('LOST', { ...draft, locationId: '' });
    const found = validateReport('FOUND', { ...draft, locationId: '' });
    expect(!lost.ok && lost.errors.locationId).toBe('กรุณาเลือกสถานที่หาย');
    expect(!found.ok && found.errors.locationId).toBe('กรุณาเลือกสถานที่พบ');
  });
  it('limits the title to 255 characters after trimming', () => {
    expect(
      validateReport('LOST', { ...draft, title: 'ก'.repeat(255) }).ok,
    ).toBe(true);
    expect(
      validateReport('LOST', { ...draft, title: `  ${'ก'.repeat(256)}  ` }).ok,
    ).toBe(false);
    expect(validateReport('LOST', { ...draft, title: '   ' }).ok).toBe(false);
  });
  it('limits the description to 10,000 characters', () => {
    expect(
      validateReport('LOST', { ...draft, description: 'x'.repeat(10000) }).ok,
    ).toBe(true);
    expect(
      validateReport('LOST', { ...draft, description: 'x'.repeat(10001) }).ok,
    ).toBe(false);
  });
  it('rejects dates and times that do not exist', () => {
    expect(validateReport('LOST', { ...draft, date: '2026-02-31' }).ok).toBe(
      false,
    );
    expect(validateReport('LOST', { ...draft, time: '25:00' }).ok).toBe(false);
    expect(validateReport('LOST', { ...draft, date: '+275760-09-13' }).ok).toBe(
      false,
    );
  });
});

describe('incident time encoding', () => {
  it('always reads the typed time as Thai time (+07:00)', () => {
    expect(toEventDatetime('2026-11-19', '10:30')).toBe(
      '2026-11-19T10:30:00+07:00',
    );
    expect(toEventDatetime('2026-01-01', '00:00')).toBe(
      '2026-01-01T00:00:00+07:00',
    );
    expect(toEventDatetime('2026-11-19', '10:30:15')).toBe(
      '2026-11-19T10:30:15+07:00',
    );
  });
  it('is the same instant 7 hours earlier in UTC, whatever the machine zone', () => {
    expect(new Date(toEventDatetime('2026-11-19', '10:30')).toISOString()).toBe(
      '2026-11-19T03:30:00.000Z',
    );
  });
});

describe('Thai date display', () => {
  it('formats date and time as 16 พ.ย. 2569 · 10:30 น.', () => {
    expect(formatEventDatetime('2026-11-16T10:30:00+07:00')).toBe(
      '16 พ.ย. 2569 · 10:30 น.',
    );
    expect(formatEventDatetime('2026-01-05T09:05:00+07:00')).toBe(
      '5 ม.ค. 2569 · 09:05 น.',
    );
    expect(formatEventDate('2026-12-31')).toBe('31 ธ.ค. 2569');
    expect(formatEventTime('10:30')).toBe('10:30 น.');
  });
  it('leaves unreadable values untouched', () => {
    expect(formatEventDatetime('garbage')).toBe('garbage');
    expect(formatEventDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('photo rules', () => {
  it('accepts one JPG, PNG or WebP up to 4 MiB (the server limit)', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp'])
      expect(checkPhotos([image('a', type)])).toBeNull();
    expect(checkPhotos([image('a', 'image/png', PHOTO_MAX_BYTES)])).toBeNull();
  });
  it('rejects other types, empty, oversized and multiple files', () => {
    expect(checkPhotos([image('a.gif', 'image/gif')])).toMatch(/JPG, PNG/);
    expect(checkPhotos([image('a.png', 'image/png', 0)])).toMatch(/ว่างเปล่า/);
    expect(
      checkPhotos([image('a.png', 'image/png', PHOTO_MAX_BYTES + 1)]),
    ).toMatch(/4 MB/);
    expect(
      checkPhotos([image('a.png', 'image/png'), image('b.png', 'image/png')]),
    ).toMatch(/ครั้งละ 1 รูป/);
  });
  it('describes size and type for the attached photo', () => {
    expect(formatSize(1)).toBe('1 KB');
    expect(formatSize(45 * 1024)).toBe('45 KB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(photoTypeLabel('image/jpeg')).toBe('JPG');
    expect(photoTypeLabel('image/webp')).toBe('WebP');
  });
});

describe('report creation client', () => {
  const input = {
    type: 'LOST' as const,
    title: 'ร่ม',
    categoryId: 2,
    locationId: 3,
    eventDatetime: '2026-11-16T10:30:00+07:00',
  };
  it('posts JSON once and returns the new report id', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { reportId: 41 } }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createReport(input, new AbortController().signal),
    ).resolves.toBe(41);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/item-reports');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });
  it('reports the HTTP status when the server refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response('{}', { status: 422 })),
    );
    await expect(
      createReport(input, new AbortController().signal),
    ).rejects.toMatchObject({ status: 422 });
  });
  it('marks an unreadable answer with status 0 so the page can call it uncertain', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response('oops', { status: 201 })),
    );
    await expect(
      createReport(input, new AbortController().signal),
    ).rejects.toEqual(new ReportRequestError(0));
  });
  it('lets a dropped connection reject as a plain error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(
      createReport(input, new AbortController().signal),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

describe('photo upload client', () => {
  it('puts the raw file with its own content type on the same report id', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { updated: true } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = image('umbrella.webp', 'image/webp', 20);
    await uploadReportImage(41, file, new AbortController().signal);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/item-reports/41/image');
    expect(init?.method).toBe('PUT');
    expect(init?.headers).toEqual({ 'Content-Type': 'image/webp' });
    expect(init?.body).toBe(file);
  });
  it('rejects with the status when the upload fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response('{}', { status: 413 })),
    );
    await expect(
      uploadReportImage(
        41,
        image('a.png', 'image/png'),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
