'use client';
import { useState, useSyncExternalStore } from 'react';
import { AnimatedGoose } from '@/components/loading/animated-goose';
import { useMotionPolicy } from '@/components/loading/use-motion-policy';
import { CampusWorld } from './campus-world';
import { LaunchCountdown } from './countdown';
import { LaunchIcon } from './launch-icon';
import styles from './coming-soon.module.css';

const subscribeToHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

export function ComingSoonExperience() {
  const [paused, setPaused] = useState(false);
  const enhanced = useSyncExternalStore(
    subscribeToHydration,
    clientHydrated,
    serverHydrated,
  );
  const { reducedMotion, visible } = useMotionPolicy();
  const running = !paused && !reducedMotion && visible;
  return (
    <div
      className={styles.page}
      data-coming-soon
      data-enhanced={enhanced}
      data-motion={running ? 'running' : 'still'}
    >
      <header className={styles.masthead}>
        <div className={styles.brand}>
          <span className={styles.wordmark} lang="en">
            reunite<span>.</span>
          </span>
          <span className={styles.mastheadNote} lang="en">
            LOST &amp; FOUND · KMUTT
          </span>
        </div>
        <div className={styles.mastheadTools}>
          <span className={styles.launchDate} lang="en">
            24 · 11 · 2026
          </span>
          <button
            className={`${styles.iconButton} ${styles.motionButton}`}
            type="button"
            aria-label={paused ? 'เล่นภาพเคลื่อนไหว' : 'หยุดภาพเคลื่อนไหว'}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            <LaunchIcon name={paused ? 'play' : 'pause'} />
          </button>
        </div>
      </header>
      <main className={styles.theatre}>
        <span className={styles.ghostDate} aria-hidden="true">
          24
        </span>
        <div className={styles.stageArc} aria-hidden="true" />
        <div
          className={`${styles.stageArc} ${styles.second}`}
          aria-hidden="true"
        />
        <div className={styles.story}>
          <p className={`${styles.eyebrow} ${styles.entry}`}>ก่อนภารกิจเริ่ม</p>
          <h1 className={styles.entry}>
            ของสำคัญ
            <span className={styles.accent}>
              กำลังกลับมา<span>.</span>
            </span>
          </h1>
          <p className={`${styles.storyNote} ${styles.entry}`}>
            อีกไม่นาน จะมีเพื่อนช่วยหา
            <span>ให้ของสำคัญ ได้กลับไปหาคนสำคัญ</span>
          </p>
        </div>
        <CampusWorld running={running} paused={paused} visible={visible} />
        <span className={styles.worldCaption} aria-hidden="true">
          KMUTT · BANG MOD / THE SEARCH BEGINS
        </span>
        <div className={styles.mascot} aria-hidden="true">
          <AnimatedGoose className={styles.gooseArt} running={running} />
        </div>
        <LaunchCountdown />
      </main>
      <footer className={styles.signature}>
        <div className={styles.signatureStory} lang="en">
          <span>LOST.</span>
          <span>FOUND.</span>
          <span>REUNITED.</span>
        </div>
        <small className={styles.modelCredit}>
          <a href="/research/kmutt-bangmod/NOTICE.txt">ข้อมูลโมเดล</a>
          <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
          <span>·</span>
          <a href="https://docs.overturemaps.org/attribution/">Overture</a>
        </small>
        <span lang="en">KMUTT · BANG MOD</span>
      </footer>
    </div>
  );
}
