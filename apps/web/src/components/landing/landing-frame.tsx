'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMotionPolicy } from '@/components/loading/use-motion-policy';
import { ShellIcon } from '@/components/shell/shell-icon';
import { ShellMotionProvider } from '@/components/shell/shell-motion';
import styles from './landing.module.css';

const clampProgress = (value: number) => Math.max(0, Math.min(1, value));

export function LandingFrame({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { reducedMotion, visible } = useMotionPolicy();
  const [paused, setPaused] = useState(false);
  const running = visible && !reducedMotion && !paused;

  useEffect(() => {
    const page = root.current;
    if (!page || !running) return;
    const reveals = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting || !(target instanceof HTMLElement)) continue;
          target.dataset.revealed = 'true';
          reveals.unobserve(target);
        }
      },
      { threshold: 0.18 },
    );
    page
      .querySelectorAll('[data-reveal]:not([data-revealed])')
      .forEach((node) => reveals.observe(node));

    const scenes = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!(target instanceof HTMLElement)) continue;
        target.dataset.sceneVisible = String(isIntersecting);
        if (isIntersecting) target.dataset.sceneEntered = 'true';
      }
    });
    page
      .querySelectorAll('[data-scene]')
      .forEach((node) => scenes.observe(node));

    const moving = [...page.querySelectorAll<HTMLElement>('[data-parallax]')];
    const hero = page.querySelector<HTMLElement>('[data-landing-hero]');
    const stage = hero?.querySelector<HTMLElement>('[data-landing-stage]');
    const report = page.querySelector<HTMLElement>('[data-report-story]');
    const route = page.querySelector<HTMLElement>('[data-route-story]');
    const routeMap = route?.querySelector<HTMLElement>('[data-route-map]');
    let frame = 0;
    function update() {
      frame = 0;
      const height = window.innerHeight;
      const scale = window.innerWidth < 760 ? 0.62 : 1;
      const heroBounds = hero?.getBoundingClientRect();
      const reportBounds = report?.getBoundingClientRect();
      const routeBounds = routeMap?.getBoundingClientRect();
      const samples = moving.map((node) => ({
        node,
        rect: node.parentElement?.getBoundingClientRect(),
      }));
      if (stage && heroBounds && heroBounds.height > 0) {
        const cue = clampProgress(
          (-heroBounds.top - 18) /
            Math.min(heroBounds.height * 0.68, height * 0.51),
        ).toFixed(3);
        if (stage.dataset.clueProgress !== cue) {
          stage.dataset.clueProgress = cue;
          stage.dispatchEvent(new Event('reunite:clue'));
        }
      }
      if (report && reportBounds) {
        const runway = Math.max(height * 0.54, reportBounds.height - height);
        const progress = clampProgress(
          (height * 0.24 - reportBounds.top) / runway,
        );
        report.style.setProperty('--report-progress', progress.toFixed(3));
      }
      if (route && routeBounds) {
        const progress = clampProgress(
          (height * 0.89 - routeBounds.top) / (height * 0.66),
        );
        route.style.setProperty(
          '--route-dash-offset',
          (1 - progress).toFixed(3),
        );
      }
      for (const { node, rect } of samples) {
        if (!rect || rect.bottom < 0 || rect.top >= height) continue;
        const progress = Math.max(
          -1,
          Math.min(
            1,
            (height - 2 * (rect.top + rect.height / 2)) /
              (height + rect.height),
          ),
        );
        node.style.setProperty(
          '--parallax-y',
          `${progress * Number(node.dataset.parallax) * scale}px`,
        );
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      reveals.disconnect();
      scenes.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [running]);

  return (
    <ShellMotionProvider value={running}>
      <div
        ref={root}
        id="landing-top"
        className={styles.page}
        data-landing-motion={running ? 'running' : 'still'}
        data-landing-scroll={reducedMotion ? 'static' : 'enhanced'}
      >
        <a className={styles.skip} href="#landing-content">
          ข้ามไปยังเนื้อหา
        </a>
        <header className={styles.header}>
          <a href="#landing-top" className={styles.wordmark} lang="en">
            reunite<span>.</span>
          </a>
          <nav aria-label="แนะนำ Reunite" className={styles.nav}>
            <a href="#story">เรื่องของเรา</a>
            <a href="#campus">แผนที่</a>
            <a href="#team">ผู้จัดทำ</a>
          </nav>
          <div className={styles.tools}>
            <button
              className={styles.motion}
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label="หยุดภาพเคลื่อนไหว"
              aria-pressed={paused || reducedMotion}
              disabled={reducedMotion}
            >
              <ShellIcon name={paused || reducedMotion ? 'play' : 'pause'} />
            </button>
            <Link href="/login" className={styles.headerLogin} prefetch={false}>
              เข้าสู่ระบบ
            </Link>
          </div>
        </header>
        {children}
      </div>
    </ShellMotionProvider>
  );
}
