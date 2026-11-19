'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useShellMotion } from '@/components/shell/shell-motion';
import type { GooseFocus, GooseScene } from './goose-scene';
import styles from './landing.module.css';

const characters = [
  {
    id: 'team',
    title: 'ทั้งทีม',
    image: 'finding-party-studio',
    alt: 'ทีม Agent Honk กับร่มพับสีน้ำเงินที่ริมแท่น',
  },
  {
    id: 'Agent',
    title: 'Agent Honk',
    image: 'agent',
    alt: 'ห่านนักสืบสวมเสื้อโค้ตและถือกล้องส่องทางไกล',
  },
  {
    id: 'Scout',
    title: 'ห่านสำรวจ',
    image: 'scout',
    alt: 'ห่านสวมหมวกสีส้มและสะพายกระเป๋า',
  },
  {
    id: 'Keeper',
    title: 'ห่านช่วยคืน',
    image: 'keeper',
    alt: 'ห่านผ้าพันคอสีส้มถือพวงกุญแจ',
  },
] as const;

export function GooseStage() {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GooseScene | null>(null);
  const [inView, setInView] = useState(false);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<'poster' | 'loading' | 'ready'>(
    'poster',
  );
  const [focus, setFocus] = useState<GooseFocus>('team');
  const running = useShellMotion();
  const playing = running && inView;
  const ready = status === 'ready';
  const current = characters.find(({ id }) => id === focus) ?? characters[0];
  const poster = ready ? characters[0] : current;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(Boolean(entry?.isIntersecting)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || requested) return;
    const load = () => {
      setStatus('loading');
      setRequested(true);
    };
    if ('requestIdleCallback' in window) {
      const idle = window.requestIdleCallback(load, { timeout: 1300 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = setTimeout(load, 280);
    return () => clearTimeout(timer);
  }, [playing, requested]);

  useEffect(() => {
    if (!requested) return;
    const target = canvas.current;
    const area = container.current;
    if (!target || !area) return;
    const controller = new AbortController();
    const fail = () => setStatus('poster');
    void import('./goose-scene')
      .then(({ mountGooseScene }) => {
        if (controller.signal.aborted) return;
        scene.current = mountGooseScene(target, area, controller.signal, fail);
        return scene.current.ready.then(() => {
          if (!controller.signal.aborted) setStatus('ready');
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          scene.current?.dispose();
          fail();
        }
      });
    return () => {
      controller.abort();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [requested]);

  useEffect(() => {
    scene.current?.setRunning(playing && ready);
  }, [playing, ready]);
  useEffect(() => {
    if (ready) scene.current?.setFocus(focus);
  }, [focus, ready]);

  return (
    <figure className={styles.heroFigure} data-scene>
      <div
        className={styles.stageBackdrop}
        data-parallax="36"
        aria-hidden="true"
      />
      <div
        className={styles.stage}
        ref={container}
        data-landing-stage={status}
        data-parallax="-24"
      >
        <Image
          className={styles.poster}
          src={`/landing/${poster.image}.webp`}
          alt={poster.alt}
          width={poster.id === 'team' ? 1200 : 640}
          height={poster.id === 'team' ? 1024 : 740}
          sizes="(max-width: 760px) 100vw, (max-width: 1300px) 58vw, 740px"
          fetchPriority="high"
          loading="eager"
        />
        <canvas className={styles.canvas} ref={canvas} aria-hidden="true" />
        <span className={styles.loadingEdge} aria-hidden="true" />
      </div>
      <figcaption className={styles.cast}>
        <div
          className={styles.castOptions}
          role="group"
          aria-label="เลือกดูตัวละคร"
        >
          {characters.map(({ id, title }) => (
            <button
              key={id}
              type="button"
              aria-pressed={focus === id}
              onClick={() => setFocus(id)}
            >
              {title}
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
