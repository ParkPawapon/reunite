'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { LaunchScene } from './scene';
import { LaunchIcon } from './launch-icon';
import styles from './coming-soon.module.css';

export function CampusWorld({
  running,
  paused,
  visible,
}: {
  running: boolean;
  paused: boolean;
  visible: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<LaunchScene | null>(null);
  const motion = useRef(running);
  const previousPause = useRef(paused);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [moduleFailed, setModuleFailed] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    let failed = false;
    let instance: LaunchScene | undefined;
    let imported = false;
    async function mount() {
      try {
        const { mountLaunchScene } = await import('./scene');
        imported = true;
        if (!active || !canvas.current || !container.current) return;
        instance = mountLaunchScene({
          canvas: canvas.current,
          container: container.current,
          signal: abort.signal,
          running: motion.current,
          onFailure() {
            failed = true;
            if (active) setState('error');
          },
        });
        scene.current = instance;
        await instance.ready;
        if (active && !failed) setState('ready');
      } catch {
        if (active && !abort.signal.aborted) {
          setModuleFailed(!imported);
          setState('error');
        }
      }
    }
    void mount();
    return () => {
      active = false;
      abort.abort();
      instance?.dispose();
      if (scene.current === instance) scene.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    motion.current = running;
    scene.current?.setRunning(running, previousPause.current && !paused);
    previousPause.current = paused;
  }, [running, paused]);

  return (
    <>
      <div
        ref={container}
        className={styles.sceneShell}
        data-state={state}
        data-campus-world
        aria-busy={visible && state === 'loading'}
      >
        <Image
          src="/coming-soon/bangmod-launch.png"
          alt="โมเดลมหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี วิทยาเขตบางมด"
          fill
          sizes="(max-width: 760px) 145vw, 78vw"
          preload
          className={styles.campusPoster}
          aria-hidden={state === 'ready'}
        />
        <canvas
          key={attempt}
          ref={canvas}
          className={styles.sceneCanvas}
          tabIndex={state === 'ready' ? 0 : -1}
          aria-hidden={state !== 'ready'}
          aria-label="โมเดลบางมดสามมิติ ใช้ปุ่มลูกศรซ้ายขวาหรือลากเพื่อหมุน ใช้ Home เพื่อคืนมุมมอง"
        />
      </div>
      {state === 'ready' && (
        <>
          <div
            className={styles.sceneTools}
            role="group"
            aria-label="ควบคุมมุมมองสามมิติ"
          >
            <button
              className={styles.iconButton}
              type="button"
              aria-label="หมุนโมเดลไปทางซ้าย"
              onClick={() => scene.current?.rotate(-1)}
            >
              <LaunchIcon name="left" />
            </button>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="หมุนโมเดลไปทางขวา"
              onClick={() => scene.current?.rotate(1)}
            >
              <LaunchIcon name="right" />
            </button>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="คืนมุมมองเริ่มต้น"
              onClick={() => scene.current?.reset()}
            >
              <LaunchIcon name="reset" />
            </button>
          </div>
          <span className={styles.sceneHint}>
            <LaunchIcon name="drag" />
            ลากเพื่อหมุนโลกบางมด
          </span>
        </>
      )}
      <p className={styles.sceneStatus} role="status" aria-live="polite">
        {state === 'loading'
          ? 'กำลังเตรียมโลกบางมด…'
          : state === 'error'
            ? 'แสดงภาพสำรองของบางมด'
            : ''}
      </p>
      {state === 'error' && (
        <button
          className={styles.retryScene}
          type="button"
          onClick={() => {
            if (moduleFailed) {
              window.location.reload();
              return;
            }
            setState('loading');
            setAttempt((value) => value + 1);
          }}
        >
          {moduleFailed ? 'โหลดหน้าใหม่' : 'ลองเปิด 3D อีกครั้ง'}
        </button>
      )}
    </>
  );
}
