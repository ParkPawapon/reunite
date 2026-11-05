'use client';

import { useState } from 'react';
import { useMotionPolicy } from './use-motion-policy';
import { AnimatedGoose } from './animated-goose';
import styles from './loading-screen.module.css';

export function LoadingScreen({
  message = 'กำลังโหลด…',
  embedded = false,
}: {
  message?: string;
  embedded?: boolean;
}) {
  const { reducedMotion, visible } = useMotionPolicy();
  const [paused, setPaused] = useState(false);
  const running = !reducedMotion && visible && !paused;

  return (
    <section
      className={`${styles.screen} ${embedded ? styles.embedded : ''}`}
      aria-label="กำลังโหลดข้อมูล"
      data-loading-screen
      data-animation={running ? 'running' : 'still'}
      data-reduced-motion={reducedMotion}
    >
      <div className={styles.center}>
        <AnimatedGoose className={styles.mascot} running={running} />
        <div className={styles.statusRow}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <p role="status" aria-live="polite" aria-atomic="true">
            {message}
          </p>
          {!reducedMotion && (
            <button
              className={styles.pause}
              type="button"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? 'เล่นภาพเคลื่อนไหว' : 'หยุดภาพเคลื่อนไหว'}
              title={paused ? 'เล่นภาพเคลื่อนไหว' : 'หยุดภาพเคลื่อนไหว'}
              aria-pressed={paused}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                {paused ? (
                  <path d="m5 3 8 5-8 5Z" fill="currentColor" />
                ) : (
                  <path
                    d="M5 3v10m6-10v10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
