'use client';
import Link from 'next/link';
import { useLaunchClock } from './launch-clock';
import { countdownAt, LAUNCH_DATE, LAUNCH_DATE_LABEL } from './launch';
import styles from './coming-soon.module.css';

const units = [
  ['days', 'วัน'],
  ['hours', 'ชั่วโมง'],
  ['minutes', 'นาที'],
  ['seconds', 'วินาที'],
] as const;

export function LaunchCountdown() {
  const now = useLaunchClock();
  const countdown = now === null ? null : countdownAt(now);
  return (
    <>
      {countdown?.launched && (
        <p className={styles.afterLaunch} role="status" aria-live="polite">
          เราพร้อมแล้ว พบกันที่ Reunite
          <Link href="/login" prefetch={false}>
            เริ่มภารกิจ
          </Link>
        </p>
      )}
      <section
        className={`${styles.launchConsole} ${styles.consoleEntry}`}
        aria-label="กำหนดเปิดตัว Reunite"
      >
        <div
          className={styles.countdown}
          role="timer"
          aria-label="เวลาที่เหลือก่อนเปิดตัว"
          aria-live="off"
          data-launch-countdown
        >
          {units.map(([key, label]) => {
            const value = countdown
              ? String(countdown[key]).padStart(2, '0')
              : '—';
            return (
              <div className={styles.countdownCell} key={key}>
                <span className={styles.digits} data-unit={key}>
                  <span key={value} className={styles.digitReveal}>
                    {value}
                  </span>
                </span>
                <span className={styles.unit}>{label}</span>
              </div>
            );
          })}
        </div>
        <div className={styles.release}>
          <div className={styles.releaseDay} aria-hidden="true">
            <strong>24</strong>
            <small>NOV</small>
          </div>
          <div className={styles.releaseCopy}>
            <p>เปิดภารกิจพร้อมกัน</p>
            <time dateTime={LAUNCH_DATE}>{LAUNCH_DATE_LABEL}</time>
            <small>00:00 น. · เวลาไทย</small>
          </div>
        </div>
      </section>
    </>
  );
}
