'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { submitLogout } from '@/modules/auth/presentation/logout-client';
import {
  AccountRequestError,
  accountRequest,
} from '@/modules/users/presentation/profile-client';
import { profileCompletionSchema } from '@/modules/users/presentation/profile-schema';
import type { StudentProfile } from '@/modules/users/domain/profile';
import { LoginShell } from './login-shell';
import styles from './login.module.css';

const completionResult = z.object({ completed: z.literal(true) });
type Fields = Pick<StudentProfile, 'firstName' | 'lastName' | 'studentId'>;
type Action = 'save' | 'logout';

export function CompleteProfileForm({ initial }: { initial: Fields }) {
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
      setFailure('กรุณากรอกชื่อและนามสกุล และรหัสนักศึกษาเป็นตัวเลข 8–20 หลัก');
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
        <p className={styles.formIntro}>กรอกข้อมูลให้ครบก่อนเริ่มใช้ Reunite</p>
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
          <div className={styles.field}>
            <label htmlFor="completion-first-name">ชื่อจริง</label>
            <div className={styles.inputWrap}>
              <input
                id="completion-first-name"
                name="firstName"
                autoComplete="given-name"
                maxLength={100}
                required
                readOnly={pending !== null}
                defaultValue={initial.firstName ?? ''}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="completion-last-name">นามสกุล</label>
            <div className={styles.inputWrap}>
              <input
                id="completion-last-name"
                name="lastName"
                autoComplete="family-name"
                maxLength={100}
                required
                readOnly={pending !== null}
                defaultValue={initial.lastName ?? ''}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="completion-student-id">รหัสนักศึกษา</label>
            <div className={styles.inputWrap}>
              <input
                id="completion-student-id"
                name="studentId"
                inputMode="numeric"
                pattern="[0-9]{8,20}"
                maxLength={20}
                aria-describedby="completion-student-id-hint"
                required
                readOnly={pending !== null}
                defaultValue={initial.studentId ?? ''}
              />
            </div>
            <p className={styles.formIntro} id="completion-student-id-hint">
              ตัวเลข 8–20 หลัก
            </p>
          </div>
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
