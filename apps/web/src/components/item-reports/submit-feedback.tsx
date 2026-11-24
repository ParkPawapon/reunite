'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Button from '@mui/material/Button';
import { ShellIcon } from '@/components/shell/shell-icon';
import { formatEventDatetime } from './report-format';
import type { SubmitState } from './use-report-submit';
import styles from './submit-feedback.module.css';

// Opens in a new tab so signing in again cannot wipe what the user typed.
const SignInLink = () => (
  <a
    className={styles.link}
    href="/login"
    target="_blank"
    rel="noopener noreferrer"
  >
    เข้าสู่ระบบในแท็บใหม่
  </a>
);

function Created({
  state,
}: {
  state: Extract<SubmitState, { status: 'created' }>;
}) {
  const panel = useRef<HTMLElement>(null);
  // Move the keyboard and screen reader to the result as soon as it appears.
  useEffect(() => {
    panel.current?.focus();
  }, []);
  return (
    <section
      ref={panel}
      className={styles.success}
      role="status"
      tabIndex={-1}
      aria-labelledby="report-success-title"
    >
      <span className={styles.successIcon}>
        <ShellIcon name="check" width={24} height={24} />
      </span>
      <div className={styles.successBody}>
        <h2 id="report-success-title" className={styles.successTitle}>
          แจ้งรายการแล้ว
        </h2>
        <p className={styles.successLine}>
          {state.summary.title} · เลขที่ {state.reportId}
        </p>
        <p className={styles.successLine}>
          {formatEventDatetime(state.summary.eventDatetime)}
          {state.summary.withPhoto
            ? (state.summary.photoCount ?? 1) > 1
              ? ` · แนบ ${state.summary.photoCount} รูปแล้ว`
              : ' · แนบรูปแล้ว'
            : ''}
        </p>
      </div>
      <Button
        component={Link}
        href="/dashboard"
        variant="contained"
        className={styles.home}
      >
        กลับหน้าหลัก
      </Button>
    </section>
  );
}

export function SubmitFeedback({
  state,
  busy,
  onRetryPhoto,
}: {
  state: SubmitState;
  busy: boolean;
  onRetryPhoto: () => void;
}) {
  if (state.status === 'pending' && state.phase === 'uploading')
    return (
      <p className={styles.srOnly} role="status">
        กำลังแนบรูป…
      </p>
    );
  if (state.status === 'created') return <Created state={state} />;
  if (state.status === 'failed')
    return (
      <div role="alert" className={styles.notice}>
        <p>
          {state.message}
          {state.expired ? (
            <>
              {' '}
              <SignInLink />
            </>
          ) : null}
        </p>
      </div>
    );
  if (state.status === 'uncertain')
    return (
      <div role="alert" className={styles.notice}>
        <p>
          ยังไม่ทราบว่าส่งรายการสำเร็จหรือไม่ เพราะการเชื่อมต่อขัดข้อง
          กรุณาตรวจสอบที่หน้าหลักก่อนส่งซ้ำ เพื่อไม่ให้ได้รายการซ้ำ{' '}
          <a
            className={styles.link}
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            เปิดหน้าหลักในแท็บใหม่
          </a>
        </p>
      </div>
    );
  if (state.status === 'photoFailed')
    return (
      <div role="alert" className={styles.notice}>
        <p>
          แจ้งรายการแล้ว แต่แนบรูปไม่สำเร็จ
          <br />
          {state.reason}
          {state.expired ? (
            <>
              {' '}
              <SignInLink />
            </>
          ) : null}
        </p>
        <Button
          type="button"
          variant="outlined"
          className={styles.retry}
          color="primary"
          disabled={busy}
          onClick={onRetryPhoto}
          startIcon={<ShellIcon name="refresh" width={16} height={16} />}
        >
          ลองแนบรูปอีกครั้ง
        </Button>
      </div>
    );
  return null;
}
