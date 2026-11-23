'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { submitLogout } from '@/modules/auth/presentation/logout-client';
import {
  AccountRequestError,
  accountRequest,
} from '@/modules/users/presentation/profile-client';
import { profileCompletionSchema } from '@/modules/users/presentation/profile-schema';
import type { EducationFields } from '@/modules/users/domain/profile';
import { LoginShell } from './login-shell';
import styles from './login.module.css';

const completionResult = z.object({ completed: z.literal(true) });
type Action = 'save' | 'logout';
const fields = [
  { key: 'studentId', label: 'รหัสนักศึกษา', maxLength: 20 },
  { key: 'faculty', label: 'คณะ', maxLength: 180 },
  { key: 'department', label: 'ภาควิชา', maxLength: 180 },
  { key: 'major', label: 'สาขาวิชา', maxLength: 180 },
] as const;

export function CompleteProfileForm({ initial }: { initial: EducationFields }) {
  const [pending, setPending] = useState<Action | null>(null);
  const [failure, setFailure] = useState('');
  const busy = useRef(false);
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);

  async function execute(action: Action, request: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setPending(action);
    setFailure('');
    try {
      await request();
      window.location.replace(action === 'save' ? '/dashboard' : '/login');
    } catch (error) {
      if (error instanceof AccountRequestError && error.status === 401) {
        window.location.replace('/login');
        return;
      }
      setFailure(
        error instanceof AccountRequestError && error.status === 409
          ? 'รหัสนักศึกษานี้ถูกใช้แล้ว กรุณาตรวจสอบและลองอีกครั้ง'
          : action === 'save'
            ? 'บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง'
            : 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง',
      );
      busy.current = false;
      setPending(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = profileCompletionSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!input.success) {
      setFailure('กรุณาตรวจสอบข้อมูล รหัสนักศึกษาต้องเป็นตัวเลข 8–20 หลัก');
      return;
    }
    void execute('save', () =>
      accountRequest('/api/v1/profile/complete', completionResult, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.data),
      }),
    );
  }

  return (
    <LoginShell ready headingId="complete-profile-heading">
      <div className={styles.formContent}>
        <h1 id="complete-profile-heading">ตั้งค่าโปรไฟล์</h1>
        <p className={styles.formIntro}>ข้อมูลการศึกษา (ไม่บังคับ)</p>
        <form
          className={styles.form}
          onSubmit={submit}
          aria-busy={pending === 'save'}
        >
          {failure && (
            <div
              className={styles.alert}
              ref={alert}
              role="alert"
              tabIndex={-1}
            >
              {failure}
            </div>
          )}
          {fields.map(({ key, label, maxLength }) => (
            <div className={styles.field} key={key}>
              <label htmlFor={`completion-${key}`}>{label}</label>
              <div className={styles.inputWrap}>
                <input
                  id={`completion-${key}`}
                  name={key}
                  inputMode={key === 'studentId' ? 'numeric' : undefined}
                  pattern={key === 'studentId' ? '[0-9]{8,20}' : undefined}
                  maxLength={maxLength}
                  readOnly={pending !== null}
                  defaultValue={initial[key] ?? ''}
                />
              </div>
            </div>
          ))}
          <button
            type="submit"
            className={styles.submit}
            disabled={pending !== null}
          >
            {pending === 'save' ? 'กำลังบันทึก…' : 'บันทึกและไปหน้าภาพรวม'}
          </button>
        </form>
        <div className={styles.microsoftForm}>
          <button
            type="button"
            className={styles.submit}
            disabled={pending !== null}
            onClick={() =>
              void execute('logout', () =>
                submitLogout(AbortSignal.timeout(15000)),
              )
            }
          >
            {pending === 'logout' ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
          </button>
        </div>
      </div>
    </LoginShell>
  );
}
