'use client';
import { useState, type ReactNode } from 'react';
import { AnimatedGoose } from '@/components/loading/animated-goose';
import { useMotionPolicy } from '@/components/loading/use-motion-policy';
import styles from './login.module.css';

export function LoginShell({
  children,
  ready = false,
  failed = false,
}: {
  children: ReactNode;
  ready?: boolean;
  failed?: boolean;
}) {
  const [privateMode, setPrivateMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const { reducedMotion, visible } = useMotionPolicy();
  const running = visible && !reducedMotion && !paused;
  const busy = !ready && !failed;
  return (
    <main
      className={styles.page}
      data-login-shell
      data-login-screen={ready || undefined}
      data-login-state={ready ? 'ready' : failed ? 'error' : 'loading'}
      data-animation={running ? 'running' : 'still'}
      data-reduced-motion={reducedMotion}
    >
      <section
        className={styles.story}
        aria-label="Reunite เพื่อนช่วยตามหาของหาย"
      >
        <div className={styles.brand}>
          <span className={styles.brandName} lang="en">
            reunite<span>.</span>
          </span>
          <span className={styles.brandDetail} lang="en">
            LOST &amp; FOUND · KMUTT
          </span>
        </div>
        <div className={styles.storyCopy}>
          <p className={styles.eyebrow}>เพื่อนช่วยหา ของหายที่บางมด</p>
          <h2>
            ของหาย
            <br />
            <span>มีเพื่อนช่วยหา</span>
          </h2>
          <p className={styles.storyNote}>ให้ของสำคัญ ได้กลับไปหาคนสำคัญ</p>
        </div>
        <div className={styles.scene}>
          <div className={styles.orbit} aria-hidden="true" />
          <svg
            className={styles.viewfinder}
            viewBox="0 0 340 360"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M29 80V54h27m255 26V54h-27M29 280v26h27m255-26v26h-27"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="170"
              cy="180"
              r="133"
              stroke="currentColor"
              strokeWidth=".7"
              strokeDasharray="2 9"
            />
          </svg>
          <svg
            className={styles.notePaper}
            viewBox="0 0 108 116"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="4"
              y="4"
              width="100"
              height="108"
              rx="13"
              fill="var(--color-surface)"
              stroke="var(--color-orange-200)"
            />
            <path
              d="m31 20-4 76m24-70 4 71m25-75-1 77"
              stroke="var(--color-orange-100)"
            />
            <path
              d="M22 85c-1-29 38-8 35-34-2-17 14-12 24-17"
              stroke="var(--color-orange-400)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="3 6"
            />
            <circle
              cx="22"
              cy="85"
              r="4"
              fill="var(--color-brand-yellow)"
              stroke="var(--color-orange-800)"
              strokeWidth="1.5"
            />
            <path
              d="M89 28c0 7-8 15-8 15s-8-8-8-15a8 8 0 1 1 16 0Z"
              fill="var(--color-brand-orange)"
            />
            <circle cx="81" cy="28" r="2.5" fill="var(--color-surface)" />
          </svg>
          <svg
            className={styles.trail}
            viewBox="0 0 600 310"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 263c102 0 72-119 162-106s32 119 139 81S366 20 491 53"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="3 8"
              strokeLinecap="round"
            />
            <circle cx="491" cy="53" r="5" fill="currentColor" stroke="none" />
          </svg>
          <svg
            className={styles.clue}
            viewBox="0 0 84 84"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="5"
              width="74"
              height="74"
              rx="22"
              fill="var(--color-surface)"
            />
            <path
              d="m37 43 20 20 7-7-5-5 4-4-7-7-5 5-7-7"
              stroke="var(--color-orange-800)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle
              cx="31"
              cy="31"
              r="15"
              fill="var(--color-brand-yellow)"
              stroke="var(--color-orange-800)"
              strokeWidth="2.5"
            />
            <circle
              cx="28"
              cy="28"
              r="4"
              stroke="var(--color-orange-800)"
              strokeWidth="2.5"
            />
          </svg>
          <AnimatedGoose
            className={styles.goose}
            running={running}
            privateMode={privateMode}
          />
        </div>
        <div className={styles.storyFooter}>
          <span>อยู่ใกล้กัน ช่วยกันหา</span>
          {!reducedMotion && (
            <button
              type="button"
              className={styles.motionButton}
              aria-label={paused ? 'เล่นภาพเคลื่อนไหว' : 'หยุดภาพเคลื่อนไหว'}
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? '▷' : 'Ⅱ'}
            </button>
          )}
        </div>
      </section>

      <section
        className={styles.formPanel}
        aria-label={ready ? undefined : 'กำลังเตรียมหน้าเข้าสู่ระบบ'}
        aria-labelledby={ready ? 'login-heading' : undefined}
        aria-busy={busy}
        onFocusCapture={(event) =>
          setPrivateMode(
            event.target instanceof Element &&
              !!event.target.closest('[data-login-password]'),
          )
        }
        onBlurCapture={(event) =>
          setPrivateMode(
            event.relatedTarget instanceof Element &&
              !!event.relatedTarget.closest('[data-login-password]'),
          )
        }
      >
        {children}
        <p className={styles.formFooter}>
          พื้นที่เล็ก ๆ ที่ช่วยให้ของหายได้กลับบ้าน
        </p>
      </section>
      <span role="status" aria-live="polite" className={styles.srOnly}>
        {busy ? 'กำลังเตรียมหน้าเข้าสู่ระบบ…' : ''}
      </span>
    </main>
  );
}
