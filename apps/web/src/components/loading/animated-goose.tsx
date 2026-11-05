'use client';
import { useEffect, useRef } from 'react';
import { useAnimate } from 'motion/react-mini';
import { GooseIllustration } from './goose-illustration.generated';
import styles from './animated-goose.module.css';

export function AnimatedGoose({
  className,
  running,
  privateMode = false,
}: {
  className?: string;
  running: boolean;
  privateMode?: boolean;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const playback = useRef<ReturnType<typeof animate>[]>([]);
  const playing = running && !privateMode;
  useEffect(() => {
    if (typeof Element.prototype.animate !== 'function') return;
    const loop = {
      autoplay: false,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    };
    const controls = [
      animate(
        '[data-honk-part="lookout"]',
        {
          transform: [
            'rotate(-1.5deg)',
            'rotate(-1.5deg)',
            'rotate(2.2deg)',
            'rotate(2.2deg)',
            'rotate(-2.4deg)',
            'rotate(-2.4deg)',
            'rotate(-1.5deg)',
          ],
        },
        { ...loop, duration: 6.4, times: [0, 0.15, 0.35, 0.52, 0.72, 0.85, 1] },
      ),
      animate(
        '[data-honk-part="goose-body"]',
        {
          transform: [
            'translateY(0) scaleY(1)',
            'translateY(-1px) scaleY(1.009)',
            'translateY(0) scaleY(1)',
          ],
        },
        { ...loop, duration: 3.2 },
      ),
      animate(
        '[data-honk-part="eye"]',
        {
          transform: [
            'scaleY(1)',
            'scaleY(1)',
            'scaleY(.08)',
            'scaleY(1)',
            'scaleY(1)',
            'scaleY(.08)',
            'scaleY(1)',
            'scaleY(1)',
          ],
        },
        {
          ...loop,
          duration: 6.4,
          times: [0, 0.28, 0.295, 0.31, 0.72, 0.735, 0.75, 1],
        },
      ),
      animate(
        '[data-honk-part="ground-shadow"]',
        {
          transform: ['scaleX(1)', 'scaleX(.98)', 'scaleX(1)'],
        },
        { ...loop, duration: 3.2 },
      ),
      animate(
        '[data-honk-part="left-foot"]',
        {
          transform: [
            'rotate(0)',
            'rotate(0)',
            'rotate(-3deg)',
            'rotate(0)',
            'rotate(0)',
          ],
        },
        { ...loop, duration: 6.4, times: [0, 0.62, 0.72, 0.82, 1] },
      ),
    ];
    playback.current = controls;
    return () => {
      controls.forEach((control) => control.stop());
      playback.current = [];
    };
  }, [animate]);

  useEffect(() => {
    playback.current.forEach((control) =>
      playing ? control.play() : control.pause(),
    );
  }, [playing]);

  return (
    <div
      className={styles.scope}
      ref={scope}
      data-private={privateMode}
      data-goose-animation={playing ? 'running' : 'still'}
    >
      <GooseIllustration className={`${styles.art} ${className ?? ''}`} />
    </div>
  );
}
