import { useEffect, useRef, useState } from 'react';
import {
  createReport,
  ReportRequestError,
  type CreateReportInput,
  type ReportType,
} from '@/modules/item-reports/presentation/reports-client';

export type SubmitState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'created'; reportId: number }
  | { status: 'failed'; message: string };

const idle: SubmitState = { status: 'idle' };

function failureMessage(error: unknown) {
  const status = error instanceof ReportRequestError ? error.status : null;
  if (status === 401)
    return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลที่กรอกยังอยู่ในหน้านี้';
  if (status === 413)
    return 'ข้อมูลยาวเกินกว่าที่ส่งได้ กรุณาตัดข้อความลักษณะสิ่งของให้สั้นลง';
  if (status === 422)
    return 'ข้อมูลบางช่องยังไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง';
  return 'ส่งรายการไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง';
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
  const submit = async (type: ReportType, input: CreateReportInput) => {
    if (busy.current || states[type].status === 'created') return;
    busy.current = true;
    controller.current = new AbortController();
    set(type, { status: 'pending' });
    try {
      const reportId = await createReport(input, controller.current.signal);
      set(type, { status: 'created', reportId });
    } catch (error) {
      if (controller.current.signal.aborted) return;
      set(type, { status: 'failed', message: failureMessage(error) });
    } finally {
      busy.current = false;
    }
  };
  const anyPending = Object.values(states).some(
    (state) => state.status === 'pending',
  );
  return { states, submit, anyPending };
}
