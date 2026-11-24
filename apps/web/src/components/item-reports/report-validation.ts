import type {
  CreateReportInput,
  ReportType,
} from '@/modules/item-reports/presentation/reports-client';
import { DESCRIPTION_LIMIT, tabCopy, type ReportDraft } from './report-draft';
import {
  isFutureDateIso,
  isFutureEventDatetime,
  nowInBangkok,
} from './report-format';

export const TITLE_LIMIT = 255;
// The campus is in Thailand, so the time the user types is always UTC+7.
const THAI_OFFSET = '+07:00';

export type FieldName = keyof ReportDraft;
export type FieldErrors = Partial<Record<FieldName, string>>;
// Order matches the form, so focus goes to the first problem the user sees.
export const FIELD_ORDER: FieldName[] = [
  'title',
  'categoryId',
  'locationId',
  'date',
  'time',
  'description',
];
export type ReportPayload = CreateReportInput;
export type ValidationResult =
  { ok: true; payload: ReportPayload } | { ok: false; errors: FieldErrors };

const isRealDate = (date: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};
const isRealTime = (time: string) =>
  /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time);

// "2026-11-19" + "10:30" -> "2026-11-19T10:30:00+07:00"
export function toEventDatetime(date: string, time: string) {
  const clock = time.length === 5 ? `${time}:00` : time;
  return `${date}T${clock}${THAI_OFFSET}`;
}

export function validateReport(
  type: ReportType,
  draft: ReportDraft,
  now: Date | number = Date.now(),
): ValidationResult {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const bangkokNow = nowInBangkok(nowMs);
  const errors: FieldErrors = {};
  const title = draft.title.trim();
  if (!title) errors.title = 'กรุณากรอกชื่อสิ่งของ';
  else if (title.length > TITLE_LIMIT)
    errors.title = `ชื่อสิ่งของต้องไม่เกิน ${TITLE_LIMIT} ตัวอักษร`;
  const categoryId = Number(draft.categoryId);
  if (!draft.categoryId || !Number.isInteger(categoryId) || categoryId < 1)
    errors.categoryId = 'กรุณาเลือกหมวดหมู่';
  const locationId = Number(draft.locationId);
  if (!draft.locationId || !Number.isInteger(locationId) || locationId < 1)
    errors.locationId = `กรุณาเลือก${tabCopy[type].place}`;
  if (!draft.date) errors.date = 'กรุณาเลือกวันที่';
  else if (!isRealDate(draft.date)) errors.date = 'วันที่ไม่ถูกต้อง';
  else if (isFutureDateIso(draft.date, bangkokNow.date))
    errors.date = 'ไม่สามารถเลือกวันที่ในอนาคตได้';
  if (!draft.time) errors.time = 'กรุณาเลือกเวลา';
  else if (!isRealTime(draft.time)) errors.time = 'เวลาไม่ถูกต้อง';
  else if (
    !errors.date &&
    isFutureEventDatetime(toEventDatetime(draft.date, draft.time), nowMs)
  )
    errors.time = 'ไม่สามารถเลือกเวลาในอนาคตได้';
  if (draft.description.length > DESCRIPTION_LIMIT)
    errors.description = `ลักษณะสิ่งของต้องไม่เกิน ${DESCRIPTION_LIMIT.toLocaleString('en-US')} ตัวอักษร`;
  if (Object.keys(errors).length) return { ok: false, errors };
  const description = draft.description.trim();
  return {
    ok: true,
    payload: {
      type,
      title,
      categoryId,
      locationId,
      eventDatetime: toEventDatetime(draft.date, draft.time),
      ...(description ? { description } : {}),
    },
  };
}
