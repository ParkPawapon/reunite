import { useLayoutEffect, useRef } from 'react';
import { useMotionPolicy } from '@/components/loading/use-motion-policy';
import type { LiveFix } from './live-position';
import type { MapPoint } from './walking';

// Keep the displayed position between the last rendered point and the new fix.
const transitionMs = 450;

export function useSmoothPosition(
  fix: LiveFix | null,
  draw: (fix: LiveFix | null) => void,
) {
  const { reducedMotion, visible } = useMotionPolicy();
  const displayed = useRef<MapPoint | null>(null);

  useLayoutEffect(() => {
    const start = displayed.current;
    function render(sample: LiveFix | null) {
      displayed.current = sample?.point ?? null;
      draw(sample);
    }
    if (
      !fix ||
      !start ||
      fix.stationary ||
      reducedMotion ||
      !visible ||
      (start[0] === fix.point[0] && start[1] === fix.point[1])
    ) {
      render(fix);
      return;
    }

    const started = performance.now();
    let frame = requestAnimationFrame(animate);
    function animate(now: number) {
      if (!fix || !start) return;
      const fraction = Math.min(1, (now - started) / transitionMs);
      render({
        ...fix,
        point: [
          start[0] + (fix.point[0] - start[0]) * fraction,
          start[1] + (fix.point[1] - start[1]) * fraction,
        ],
      });
      if (fraction < 1) frame = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(frame);
  }, [draw, fix, reducedMotion, visible]);
}
