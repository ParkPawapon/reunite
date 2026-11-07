'use client';
import { useState, useTransition } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useMotionPolicy } from '@/components/loading/use-motion-policy';
import { statusCatalog, type StatusCode } from './status-catalog';
import { StatusScene } from './status-scene';
import styles from './status.module.css';

export function StatusExperience({
  code,
  preview = false,
  onRetry,
}: {
  code: StatusCode;
  preview?: boolean;
  onRetry?: () => void;
}) {
  const item = statusCatalog[code];
  const [paused, setPaused] = useState(false);
  const [pending, startTransition] = useTransition();
  const { visible, reducedMotion } = useMotionPolicy();
  const running = visible && !reducedMotion && !paused;
  const retry = item.action === 'ลองอีกครั้ง';
  return (
    <div
      className={styles.page}
      data-status-page={code}
      data-motion={running ? 'running' : 'still'}
      data-family={code[0]}
    >
      <header className={styles.header}>
        <a
          href="/dashboard"
          className={styles.brand}
          aria-label="Reunite หน้าภาพรวม"
        >
          reunite<span>.</span>
        </a>
        <button
          type="button"
          className={styles.motionButton}
          onClick={() => setPaused((value) => !value)}
          disabled={reducedMotion}
          aria-pressed={paused || reducedMotion}
          aria-label={paused ? 'เล่นภาพเคลื่อนไหว' : 'หยุดภาพเคลื่อนไหว'}
        >
          <ShellIcon
            name={paused || reducedMotion ? 'play' : 'pause'}
            width={16}
          />
        </button>
      </header>
      <main className={styles.main}>
        <div className={styles.visual}>
          <span className={styles.code} aria-hidden="true">
            {code}
          </span>
          <StatusScene scene={item.scene} />
          <span className={styles.caseLabel} lang="en">
            REUNITE · {code[0] === '3' ? 'NEXT STOP' : 'A LITTLE DETOUR'}
          </span>
        </div>
        <div className={styles.copy}>
          {preview && (
            <a className={styles.preview} href="/research/system-states">
              ตัวอย่างหน้าสถานะ · {code} <ShellIcon name="arrow" width={14} />
            </a>
          )}
          <p className={styles.eyebrow}>
            <span />
            {code} <span lang="en">{item.label}</span>
          </p>
          <h1>{item.title}</h1>
          <p className={styles.description}>{item.description}</p>
          <div className={styles.actions}>
            {retry ? (
              <button
                type="button"
                className={styles.primary}
                aria-busy={pending}
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    if (onRetry) onRetry();
                    else window.location.reload();
                  })
                }
              >
                <ShellIcon name="refresh" width={18} />
                {pending ? 'กำลังลองใหม่…' : item.action}
              </button>
            ) : (
              <a
                className={styles.primary}
                href={code === '401' ? '/login' : '/dashboard'}
              >
                {item.action}
                <ShellIcon name="arrow" width={18} />
              </a>
            )}
            <a
              className={styles.secondary}
              href={
                preview
                  ? '/research/system-states'
                  : retry
                    ? '/dashboard'
                    : '/login'
              }
            >
              {preview
                ? 'ดูสถานะอื่น'
                : retry
                  ? 'กลับหน้าภาพรวม'
                  : 'ไปหน้าเข้าสู่ระบบ'}
            </a>
          </div>
          <p className={styles.recoveryNote}>
            {code[0] === '3'
              ? 'เส้นทางเปลี่ยน แต่เรายังไปต่อด้วยกันได้'
              : 'หลงทางนิดหน่อย ไม่เป็นไรนะ'}
          </p>
          {pending && (
            <p className={styles.retryStatus} role="status">
              กำลังเชื่อมต่ออีกครั้ง…
            </p>
          )}
        </div>
      </main>
      <footer className={styles.footer}>
        <span>เพื่อนช่วยหา</span>
        <span>พาของสำคัญ กลับไปหาคนสำคัญ</span>
      </footer>
    </div>
  );
}
