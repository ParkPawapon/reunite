'use client';

import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/loading/loading-screen';
import { JavascriptNotice } from '@/components/loading/javascript-notice';
import { LoginShell } from './login-shell';
import { LoginSkeleton } from './login-skeleton';
import styles from './login.module.css';

const INTRO_DURATION_MS = 1300;
const SKELETON_START_MS = 600;
const MODULE_TIMEOUT_MS = 15_000;
type FormComponent = typeof import('./login-form').LoginForm;

export function LoginExperience() {
  const [phase, setPhase] = useState<'intro' | 'skeleton' | 'ready'>('intro');
  const [Form, setForm] = useState<FormComponent | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const skeletonTimer = window.setTimeout(
      () => setPhase('skeleton'),
      SKELETON_START_MS,
    );
    const introTimer = window.setTimeout(
      () => setPhase('ready'),
      INTRO_DURATION_MS,
    );
    const moduleTimer = window.setTimeout(() => {
      if (active) setLoadFailed(true);
    }, MODULE_TIMEOUT_MS);
    // Fetch the form immediately, in a separate chunk. The skeleton also covers slow networks.
    void import('./login-form')
      .then((module) => {
        if (!active) return;
        window.clearTimeout(moduleTimer);
        setForm(() => module.LoginForm);
        setLoadFailed(false);
      })
      .catch(() => {
        if (active) {
          window.clearTimeout(moduleTimer);
          setLoadFailed(true);
        }
      });
    return () => {
      active = false;
      window.clearTimeout(skeletonTimer);
      window.clearTimeout(introTimer);
      window.clearTimeout(moduleTimer);
    };
  }, []);

  if (phase === 'intro')
    return (
      <main data-login-intro>
        <LoadingScreen />
        <JavascriptNotice />
      </main>
    );
  const ready = phase === 'ready' && Form !== null;
  return (
    <LoginShell ready={ready} failed={!ready && loadFailed}>
      {ready ? (
        <Form />
      ) : loadFailed ? (
        <div className={styles.formContent} role="alert" data-login-load-error>
          <h1>เปิดหน้าเข้าสู่ระบบไม่สำเร็จ</h1>
          <p className={styles.formIntro}>
            กรุณาตรวจสอบการเชื่อมต่อ แล้วลองโหลดหน้าอีกครั้ง
          </p>
          <button
            className={styles.submit}
            type="button"
            onClick={() => window.location.reload()}
          >
            ลองโหลดใหม่ <span aria-hidden="true">↗</span>
          </button>
        </div>
      ) : (
        <LoginSkeleton />
      )}
    </LoginShell>
  );
}
