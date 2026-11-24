import { useEffect, useRef, useState } from 'react';
import {
  createReport,
  ReportRequestError,
  uploadReportImage,
  type CreateReportInput,
  type ReportType,
} from '@/modules/item-reports/presentation/reports-client';

// What the success message repeats back to the user.
export type SubmitSummary = {
  title: string;
  eventDatetime: string;
  withPhoto: boolean;
  photoCount?: number;
};
export type SubmitState =
  | { status: 'idle' }
  | { status: 'pending'; phase: 'creating' | 'uploading' }
  | { status: 'created'; reportId: number; summary: SubmitSummary }
  // The report exists; only the photo is missing. Retry must never POST again.
  | {
      status: 'photoFailed';
      reportId: number;
      reason: string;
      expired: boolean;
      summary: SubmitSummary;
    }
  // The request left but its answer never arrived, so the report may exist.
  | { status: 'uncertain' }
  // `expired` lets the page offer a way to sign in again without losing the form.
  | { status: 'failed'; message: string; expired: boolean };

const idle: SubmitState = { status: 'idle' };
const SESSION_EXPIRED =
  'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลที่กรอกยังอยู่ในหน้านี้';

const statusOf = (error: unknown) =>
  error instanceof ReportRequestError ? error.status : null;

function createFailure(error: unknown): SubmitState {
  const status = statusOf(error);
  // No HTTP answer at all (or an unreadable 201) means we cannot know the result.
  if (status === null || status === 0) return { status: 'uncertain' };
  if (status === 401)
    return { status: 'failed', message: SESSION_EXPIRED, expired: true };
  if (status === 413)
    return {
      status: 'failed',
      message:
        'ข้อมูลยาวเกินกว่าที่ส่งได้ กรุณาตัดข้อความลักษณะสิ่งของให้สั้นลง',
      expired: false,
    };
  if (status === 422)
    return {
      status: 'failed',
      message: 'ข้อมูลบางช่องยังไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง',
      expired: false,
    };
  return {
    status: 'failed',
    message: 'ส่งรายการไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง',
    expired: false,
  };
}
function photoReason(error: unknown) {
  const status = statusOf(error);
  if (status === 401) return SESSION_EXPIRED;
  if (status === 413) return 'รูปมีขนาดใหญ่เกินกำหนด กรุณาเลือกรูปที่เล็กลง';
  if (status === 415 || status === 422)
    return 'ระบบอ่านรูปนี้ไม่ได้ กรุณาเลือกรูปอื่น';
  return 'ลองแนบรูปอีกครั้งเมื่อการเชื่อมต่อพร้อม';
}

export function useReportSubmit() {
  const [states, setStates] = useState<Record<ReportType, SubmitState>>({
    LOST: idle,
    FOUND: idle,
  });
  const uploadedCounts = useRef<Record<ReportType, number>>({
    LOST: 0,
    FOUND: 0,
  });
  // A ref, not state, so two clicks in the same moment cannot both pass.
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const set = (type: ReportType, state: SubmitState) =>
    setStates((current) => ({ ...current, [type]: state }));

  // Photo step on its own: also used by the retry button, with the same reportId.
  const attachPhotos = async (
    type: ReportType,
    reportId: number,
    photos: File[],
    summary: SubmitSummary,
    signal: AbortSignal,
  ) => {
    set(type, { status: 'pending', phase: 'uploading' });
    const startIndex = Math.min(uploadedCounts.current[type], photos.length);
    try {
      for (let i = startIndex; i < photos.length; i++) {
        const file = photos[i];
        if (!file) continue;
        await uploadReportImage(reportId, file, signal, i === 0 ? 1 : 'next');
        uploadedCounts.current[type] = i + 1;
      }
      set(type, {
        status: 'created',
        reportId,
        summary: {
          ...summary,
          withPhoto: photos.length > 0,
          photoCount: photos.length,
        },
      });
    } catch (error) {
      if (signal.aborted) return;
      set(type, {
        status: 'photoFailed',
        reportId,
        reason: photoReason(error),
        expired: statusOf(error) === 401,
        summary: {
          ...summary,
          withPhoto: photos.length > 0,
          photoCount: photos.length,
        },
      });
    }
  };
  const start = () => {
    busy.current = true;
    controller.current = new AbortController();
    return controller.current.signal;
  };
  const submit = async (
    type: ReportType,
    input: CreateReportInput,
    photos: File[],
  ) => {
    const current = states[type].status;
    if (busy.current || current === 'created' || current === 'photoFailed')
      return;
    const signal = start();
    uploadedCounts.current[type] = 0;
    set(type, { status: 'pending', phase: 'creating' });
    try {
      const reportId = await createReport(input, signal);
      const summary: SubmitSummary = {
        title: input.title,
        eventDatetime: input.eventDatetime,
        withPhoto: photos.length > 0,
        photoCount: photos.length,
      };
      if (photos.length)
        await attachPhotos(type, reportId, photos, summary, signal);
      else set(type, { status: 'created', reportId, summary });
    } catch (error) {
      if (!signal.aborted) set(type, createFailure(error));
    } finally {
      busy.current = false;
    }
  };
  const retryPhoto = async (type: ReportType, photos: File[]) => {
    const current = states[type];
    if (busy.current || current.status !== 'photoFailed') return;
    // The user removed the photos after the failure: the report is complete as is.
    if (!photos.length) {
      set(type, {
        status: 'created',
        reportId: current.reportId,
        summary: {
          ...current.summary,
          withPhoto: uploadedCounts.current[type] > 0,
          photoCount: uploadedCounts.current[type],
        },
      });
      return;
    }
    const signal = start();
    try {
      await attachPhotos(
        type,
        current.reportId,
        photos,
        {
          ...current.summary,
          withPhoto: true,
          photoCount: photos.length,
        },
        signal,
      );
    } finally {
      busy.current = false;
    }
  };
  const anyPending = Object.values(states).some(
    (state) => state.status === 'pending',
  );
  return { states, submit, retryPhoto, anyPending };
}
