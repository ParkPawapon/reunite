import { useEffect, useRef, useState } from 'react';
import {
  createReport,
  ReportRequestError,
  uploadReportImage,
  type CreateReportInput,
  type ReportType,
} from '@/modules/item-reports/presentation/reports-client';

export type SubmitState =
  | { status: 'idle' }
  | { status: 'pending'; phase: 'creating' | 'uploading' }
  | { status: 'created'; reportId: number }
  // The report exists; only the photo is missing. Retry must never POST again.
  | { status: 'photoFailed'; reportId: number; reason: string }
  // The request left but its answer never arrived, so the report may exist.
  | { status: 'uncertain' }
  | { status: 'failed'; message: string };

const idle: SubmitState = { status: 'idle' };
const SESSION_EXPIRED =
  'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลที่กรอกยังอยู่ในหน้านี้';

const statusOf = (error: unknown) =>
  error instanceof ReportRequestError ? error.status : null;

function createFailure(error: unknown): SubmitState {
  const status = statusOf(error);
  // No HTTP answer at all (or an unreadable 201) means we cannot know the result.
  if (status === null || status === 0) return { status: 'uncertain' };
  if (status === 401) return { status: 'failed', message: SESSION_EXPIRED };
  if (status === 413)
    return {
      status: 'failed',
      message:
        'ข้อมูลยาวเกินกว่าที่ส่งได้ กรุณาตัดข้อความลักษณะสิ่งของให้สั้นลง',
    };
  if (status === 422)
    return {
      status: 'failed',
      message: 'ข้อมูลบางช่องยังไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง',
    };
  return {
    status: 'failed',
    message: 'ส่งรายการไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง',
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
  // A ref, not state, so two clicks in the same moment cannot both pass.
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const set = (type: ReportType, state: SubmitState) =>
    setStates((current) => ({ ...current, [type]: state }));

  // Photo step on its own: also used by the retry button, with the same reportId.
  const attachPhoto = async (
    type: ReportType,
    reportId: number,
    photo: File,
    signal: AbortSignal,
  ) => {
    set(type, { status: 'pending', phase: 'uploading' });
    try {
      await uploadReportImage(reportId, photo, signal);
      set(type, { status: 'created', reportId });
    } catch (error) {
      if (signal.aborted) return;
      set(type, {
        status: 'photoFailed',
        reportId,
        reason: photoReason(error),
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
    photo: File | null,
  ) => {
    const current = states[type].status;
    if (busy.current || current === 'created' || current === 'photoFailed')
      return;
    const signal = start();
    set(type, { status: 'pending', phase: 'creating' });
    try {
      const reportId = await createReport(input, signal);
      if (photo) await attachPhoto(type, reportId, photo, signal);
      else set(type, { status: 'created', reportId });
    } catch (error) {
      if (!signal.aborted) set(type, createFailure(error));
    } finally {
      busy.current = false;
    }
  };
  const retryPhoto = async (type: ReportType, photo: File | null) => {
    const current = states[type];
    if (busy.current || current.status !== 'photoFailed') return;
    // The user removed the photo after the failure: the report is complete as is.
    if (!photo) {
      set(type, { status: 'created', reportId: current.reportId });
      return;
    }
    const signal = start();
    try {
      await attachPhoto(type, current.reportId, photo, signal);
    } finally {
      busy.current = false;
    }
  };
  const anyPending = Object.values(states).some(
    (state) => state.status === 'pending',
  );
  return { states, submit, retryPhoto, anyPending };
}
