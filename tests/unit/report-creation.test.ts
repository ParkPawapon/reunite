import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createReport,
  ReportRequestError,
  uploadReportImage,
} from '@/modules/item-reports/presentation/reports-client';
import {
  buildThaiCalendarGrid,
  clampDateTimeToNow,
  formatEventDate,
  formatEventDatetime,
  formatEventTime,
  formatThaiCalendarMonthYear,
  isFutureDateIso,
  isFutureEventDatetime,
  isFutureMonthYear,
  maxHourForDate,
  maxMinuteForDateTime,
  nowInBangkok,
  parseIsoDateParts,
  parseTimeParts,
  shiftYearMonth,
  stepTimePart,
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
  it('enforces real-time Bangkok bounds against future dates and times', () => {
    const fixedNow = new Date('2026-11-25T05:14:20+07:00');
    const fixedNowMs = fixedNow.getTime();
    const bangkok = nowInBangkok(fixedNowMs);
    expect(bangkok).toEqual({
      date: '2026-11-25',
      time: '05:14',
      year: 2026,
      month: 11,
      day: 25,
      hour: 5,
      minute: 14,
    });

    expect(
      validateReport(
        'LOST',
        { ...draft, date: '2026-11-25', time: '05:14' },
        fixedNow,
      ).ok,
    ).toBe(true);
    expect(
      validateReport(
        'LOST',
        { ...draft, date: '2026-11-24', time: '23:59' },
        fixedNow,
      ).ok,
    ).toBe(true);

    const futureDay = validateReport(
      'LOST',
      { ...draft, date: '2026-11-26', time: '00:00' },
      fixedNow,
    );
    expect(futureDay.ok).toBe(false);
    expect(!futureDay.ok && futureDay.errors.date).toBe(
      'ไม่สามารถเลือกวันที่ในอนาคตได้',
    );

    const futureTimeToday = validateReport(
      'FOUND',
      { ...draft, date: '2026-11-25', time: '05:15' },
      fixedNow,
    );
    expect(futureTimeToday.ok).toBe(false);
    expect(!futureTimeToday.ok && futureTimeToday.errors.time).toBe(
      'ไม่สามารถเลือกเวลาในอนาคตได้',
    );

    expect(isFutureDateIso('2026-11-26', bangkok.date)).toBe(true);
    expect(isFutureDateIso('2026-11-25', bangkok.date)).toBe(false);
    expect(isFutureMonthYear(2026, 12, 2026, 11)).toBe(true);
    expect(isFutureMonthYear(2027, 1, 2026, 11)).toBe(true);
    expect(isFutureMonthYear(2026, 11, 2026, 11)).toBe(false);
    expect(maxHourForDate('2026-11-25', bangkok)).toBe(5);
    expect(maxHourForDate('2026-11-24', bangkok)).toBe(23);
    expect(maxMinuteForDateTime('2026-11-25', 5, bangkok)).toBe(14);
    expect(maxMinuteForDateTime('2026-11-25', 4, bangkok)).toBe(59);
    expect(maxMinuteForDateTime('2026-11-24', 20, bangkok)).toBe(59);
    expect(clampDateTimeToNow('2026-11-28', 20, 50, bangkok)).toEqual({
      date: '2026-11-25',
      hour: 5,
      minute: 14,
    });
    expect(clampDateTimeToNow('2026-11-25', 20, 50, bangkok)).toEqual({
      date: '2026-11-25',
      hour: 5,
      minute: 14,
    });
    expect(clampDateTimeToNow('2026-11-24', 20, 50, bangkok)).toEqual({
      date: '2026-11-24',
      hour: 20,
      minute: 50,
    });
    expect(isFutureEventDatetime('2026-11-25T05:15:00+07:00', fixedNowMs)).toBe(
      true,
    );
    expect(isFutureEventDatetime('2026-11-25T05:14:00+07:00', fixedNowMs)).toBe(
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
  it('builds Sunday-first Thai calendar grids and wraps month/time boundaries', () => {
    expect(formatThaiCalendarMonthYear(2026, 11)).toBe('พฤศจิกายน 2569');
    expect(shiftYearMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftYearMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(parseIsoDateParts('2026-02-29')).toBeNull();
    expect(parseIsoDateParts('2026-11-25')).toEqual({
      year: 2026,
      month: 11,
      day: 25,
    });
    expect(parseTimeParts('24:00')).toBeNull();
    expect(parseTimeParts('02:04')).toEqual({ hour: 2, minute: 4 });
    expect(stepTimePart(23, 23, 1)).toBe(0);
    expect(stepTimePart(0, 23, -1)).toBe(23);
    expect(stepTimePart(59, 59, 1)).toBe(0);
    expect(stepTimePart(0, 59, -1)).toBe(59);

    const novGrid = buildThaiCalendarGrid(2026, 11);
    expect(novGrid).toHaveLength(35);
    expect(novGrid[0]).toMatchObject({
      iso: '2026-11-01',
      day: 1,
      inMonth: true,
      isSunday: true,
    });
    expect(novGrid[29]).toMatchObject({
      iso: '2026-11-30',
      day: 30,
      inMonth: true,
    });
    expect(novGrid[34]).toMatchObject({
      iso: '2026-12-05',
      day: 5,
      inMonth: false,
    });

    // August 2026 starts on Saturday and spans 6 calendar rows.
    const augGrid = buildThaiCalendarGrid(2026, 8);
    expect(augGrid).toHaveLength(42);
    expect(augGrid[0]).toMatchObject({
      iso: '2026-07-26',
      inMonth: false,
      isSunday: true,
    });
    expect(augGrid[6]).toMatchObject({ iso: '2026-08-01', inMonth: true });
  });
});

describe('photo rules', () => {
  it('accepts up to 3 JPG, PNG or WebP images up to 4 MiB each', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp'])
      expect(checkPhotos([image('a', type)])).toBeNull();
    expect(checkPhotos([image('a', 'image/png', PHOTO_MAX_BYTES)])).toBeNull();
    expect(
      checkPhotos([
        image('1.png', 'image/png'),
        image('2.png', 'image/png'),
        image('3.png', 'image/png'),
      ]),
    ).toBeNull();
    expect(checkPhotos([image('3.png', 'image/png')], 2)).toBeNull();
  });
  it('rejects other types, empty, oversized and exceeding 3 files', () => {
    expect(checkPhotos([image('a.gif', 'image/gif')])).toMatch(/JPG, PNG/);
    expect(checkPhotos([image('a.png', 'image/png', 0)])).toMatch(/ว่างเปล่า/);
    expect(
      checkPhotos([image('a.png', 'image/png', PHOTO_MAX_BYTES + 1)]),
    ).toMatch(/4 MB/);
    expect(
      checkPhotos([
        image('a.png', 'image/png'),
        image('b.png', 'image/png'),
        image('c.png', 'image/png'),
        image('d.png', 'image/png'),
      ]),
    ).toMatch(/สูงสุด 3 รูป/);
    expect(
      checkPhotos(
        [image('c.png', 'image/png'), image('d.png', 'image/png')],
        2,
      ),
    ).toMatch(/สูงสุด 3 รูป/);
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
  it('puts additional photos onto ?slot=next when requested', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { updated: true } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = image('damage.png', 'image/png', 20);
    await uploadReportImage(41, file, new AbortController().signal, 'next');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/item-reports/41/image?slot=next');
    expect(init?.method).toBe('PUT');
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
