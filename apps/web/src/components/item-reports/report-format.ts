const MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

export const THAI_WEEKDAYS_SHORT = [
  'อา.',
  'จ.',
  'อ.',
  'พ.',
  'พฤ.',
  'ศ.',
  'ส.',
] as const;

const pad2 = (value: number) => String(value).padStart(2, '0');

export function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseIsoDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function parseTimeParts(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function formatThaiCalendarMonthYear(year: number, month: number) {
  const monthName = THAI_MONTHS_FULL[month - 1];
  return monthName ? `${monthName} ${year + 543}` : `${year + 543}`;
}

export function shiftYearMonth(
  year: number,
  month: number,
  deltaMonths: number,
) {
  const utc = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1 };
}

export type ThaiCalendarCell = {
  iso: string;
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
  isSunday: boolean;
};

export function buildThaiCalendarGrid(
  year: number,
  month: number,
): ThaiCalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells: ThaiCalendarCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const current = new Date(Date.UTC(year, month - 1, 1 - firstWeekday + i));
    const cellYear = current.getUTCFullYear();
    const cellMonth = current.getUTCMonth() + 1;
    const cellDay = current.getUTCDate();
    cells.push({
      iso: formatIsoDate(cellYear, cellMonth, cellDay),
      year: cellYear,
      month: cellMonth,
      day: cellDay,
      inMonth: cellYear === year && cellMonth === month,
      isSunday: current.getUTCDay() === 0,
    });
  }
  return cells;
}

export function stepTimePart(current: number, max: number, delta: 1 | -1) {
  return (current + delta + (max + 1)) % (max + 1);
}

// "2026-11-16T10:30:00+07:00" -> "16 พ.ย. 2569 · 10:30 น."
// The value is already Thai time, so read the parts instead of converting zones.
export function formatEventDatetime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return value;
  return `${Number(day)} ${monthName} ${Number(year) + 543} · ${hour}:${minute} น.`;
}

// "2026-11-16" -> "16 พ.ย. 2569"
export function formatEventDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const monthName = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !monthName) return value;
  return `${Number(match[3])} ${monthName} ${Number(match[1]) + 543}`;
}

// "10:30" -> "10:30 น."
export const formatEventTime = (value: string) =>
  /^\d{2}:\d{2}/.test(value) ? `${value.slice(0, 5)} น.` : value;

const bangkokDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function bangkokEventFields(value: string) {
  const parts = Object.fromEntries(
    bangkokDateTime
      .formatToParts(new Date(value))
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export type BangkokNow = {
  date: string;
  time: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function nowInBangkok(now: Date | number = Date.now()): BangkokNow {
  const instant = typeof now === 'number' ? new Date(now) : now;
  const fields = bangkokEventFields(instant.toISOString());
  const dateParts = parseIsoDateParts(fields.date) ?? {
    year: 2026,
    month: 1,
    day: 1,
  };
  const timeParts = parseTimeParts(fields.time) ?? { hour: 0, minute: 0 };
  return {
    date: fields.date,
    time: fields.time,
    ...dateParts,
    ...timeParts,
  };
}

export function isFutureDateIso(dateIso: string, todayIso: string): boolean {
  return Boolean(dateIso && todayIso && dateIso > todayIso);
}

export function isFutureMonthYear(
  year: number,
  month: number,
  maxYear: number,
  maxMonth: number,
): boolean {
  return year > maxYear || (year === maxYear && month > maxMonth);
}

export function maxHourForDate(
  dateIso: string,
  now: Pick<BangkokNow, 'date' | 'hour'>,
): number {
  return dateIso >= now.date ? now.hour : 23;
}

export function maxMinuteForDateTime(
  dateIso: string,
  hour: number,
  now: Pick<BangkokNow, 'date' | 'hour' | 'minute'>,
): number {
  const cappedHour = Math.min(hour, maxHourForDate(dateIso, now));
  return dateIso >= now.date && cappedHour >= now.hour ? now.minute : 59;
}

export function clampDateTimeToNow(
  dateIso: string,
  hour: number,
  minute: number,
  now: Pick<BangkokNow, 'date' | 'hour' | 'minute'>,
): { date: string; hour: number; minute: number } {
  const safeDate =
    parseIsoDateParts(dateIso) && !isFutureDateIso(dateIso, now.date)
      ? dateIso
      : now.date;
  const safeHour = Math.min(Math.max(0, hour), maxHourForDate(safeDate, now));
  const safeMinute = Math.min(
    Math.max(0, minute),
    maxMinuteForDateTime(safeDate, safeHour, now),
  );
  return { date: safeDate, hour: safeHour, minute: safeMinute };
}

export function isFutureEventDatetime(
  eventDatetime: string,
  nowMs = Date.now(),
  toleranceMs = 0,
): boolean {
  const timestamp = Date.parse(eventDatetime);
  return Number.isFinite(timestamp) && timestamp > nowMs + toleranceMs;
}
