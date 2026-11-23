'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { loginDestination } from '@/modules/auth/presentation/login-destination';
import styles from './login.module.css';

const microsoftErrors = new Map([
  [
    'cancelled',
    'ยกเลิกการเข้าสู่ระบบ หรือ Microsoft ไม่อนุญาตให้เข้าถึงแอปนี้',
  ],
  ['denied', 'กรุณาใช้บัญชี Microsoft ของ มจธ. ที่ได้รับสิทธิ์เข้าใช้งาน'],
  ['conflict', 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาติดต่อผู้ดูแลเพื่อเชื่อมบัญชี'],
  [
    'unavailable',
    'ยังไม่สามารถเข้าสู่ระบบด้วย Microsoft ได้ กรุณาลองใหม่ภายหลัง',
  ],
  ['failed', 'เข้าสู่ระบบด้วย Microsoft ไม่สำเร็จ กรุณาลองอีกครั้ง'],
]);

function destination() {
  const { search, hash } = window.location;
  return loginDestination(new URLSearchParams(search).get('next'), hash);
}

export function LoginForm() {
  const errorRef = useRef<HTMLDivElement>(null);
  const microsoftStarting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [microsoftPending, setMicrosoftPending] = useState(false);
  const [failure, setFailure] = useState(() => {
    const error = new URLSearchParams(window.location.search).get('microsoft');
    return microsoftErrors.get(error ?? '') ?? '';
  });

  useEffect(() => {
    if (document.activeElement === document.body)
      headingRef.current?.focus({ preventScroll: true });
    function restore(event: PageTransitionEvent) {
      if (event.persisted) {
        microsoftStarting.current = false;
        setMicrosoftPending(false);
      }
    }
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  useEffect(() => {
    if (failure) errorRef.current?.focus();
  }, [failure]);

  function handleMicrosoftSubmit(event: FormEvent<HTMLFormElement>) {
    if (microsoftStarting.current) {
      event.preventDefault();
      return;
    }
    microsoftStarting.current = true;
    setMicrosoftPending(true);
    setFailure('');
    const action = new URL(event.currentTarget.action);
    action.searchParams.set('next', destination());
    event.currentTarget.action = action.href;
  }

  return (
    <div className={styles.formContent} data-login-form>
      <div className={styles.welcomeMark} aria-hidden="true">
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
          <path
            d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3 11c5 4 13 4 18 0m-9 0v5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className={styles.formEyebrow}>ยินดีต้อนรับกลับมา</p>
      <h1 id="login-heading" ref={headingRef} tabIndex={-1}>
        เข้าสู่ระบบ
      </h1>
      <p className={styles.formIntro}>อีกนิดเดียว ก็พร้อมออกตามหาแล้ว</p>
      <form
        action="/api/v1/auth/microsoft"
        method="post"
        onSubmit={handleMicrosoftSubmit}
        className={styles.signInForm}
        aria-busy={microsoftPending}
      >
        {failure && (
          <div
            ref={errorRef}
            className={styles.alert}
            role="alert"
            tabIndex={-1}
          >
            {failure}
          </div>
        )}
        <button
          type="submit"
          className={styles.submit}
          disabled={microsoftPending}
        >
          <Image
            src="/kmutt-logo.png"
            alt=""
            width={83}
            height={96}
            unoptimized
            className={styles.kmuttLogo}
          />
          <span lang={microsoftPending ? 'th' : 'en'}>
            {microsoftPending
              ? 'กำลังเปิด Microsoft…'
              : 'Sign in with KMUTT account'}
          </span>
          {microsoftPending && (
            <span className={styles.spinner} aria-hidden="true" />
          )}
        </button>
        <span className={styles.srOnly} role="status">
          {microsoftPending ? 'กำลังเปิดหน้าเข้าสู่ระบบของ Microsoft' : ''}
        </span>
      </form>
    </div>
  );
}
