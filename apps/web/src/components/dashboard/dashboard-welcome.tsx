'use client';
import { AnimatedGoose } from '@/components/loading/animated-goose';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import styles from './dashboard.module.css';
export function DashboardWelcome() {
  const running = useShellMotion();
  return (
    <section className={styles.hero} aria-labelledby="dashboard-hero-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>เพื่อนช่วยหา · REUNITE</p>
        <h2 id="dashboard-hero-title">
          ทุกเส้นทาง
          <br />
          <span>มีเพื่อนช่วยหา</span>
        </h2>
        <p className={styles.heroDescription}>
          สำรวจอาคาร วางเส้นทางเดิน
          <br />
          แล้วไปต่อในมุมที่คุ้นเคย
        </p>
        <a className={styles.primary} href="/research/kmutt-bangmod">
          เปิดแผนที่บางมด <ShellIcon name="arrow" />
        </a>
      </div>
      <div className={styles.heroArt} aria-hidden="true">
        <div className={styles.orbit} />
        <AnimatedGoose className={styles.goose} running={running} />
      </div>
    </section>
  );
}
