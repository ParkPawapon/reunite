import { useCallback, useEffect, useState } from 'react';
import { walkProgress, type WalkProgress } from './live-position';
import { useLivePosition } from './use-live-position';
import type { WalkRoute } from './walking';

type WalkSession = {
  plan: WalkRoute;
  progress: WalkProgress | null;
};

export function useWalkNavigation(plan: WalkRoute | null) {
  const [session, setSession] = useState<WalkSession | null>(null);
  const gps = useLivePosition();
  const { stop } = gps;
  const current = session && session.plan === plan ? session : null;
  const arrived = current?.progress?.status === 'near-destination';
  const liveFix =
    current && !arrived && gps.state.status === 'live' ? gps.state.fix : null;

  useEffect(() => () => stop(), [plan, stop]);

  function start() {
    if (!plan) return;
    stop();
    setSession({ plan, progress: null });
    gps.start((sample) => {
      setSession((previous) => {
        if (
          !previous ||
          previous.plan !== plan ||
          previous.progress?.status === 'near-destination'
        )
          return previous;
        return {
          ...previous,
          progress:
            sample?.status === 'live' ? walkProgress(plan, sample.fix) : null,
        };
      });
    });
  }

  const end = useCallback(() => {
    stop();
    setSession(null);
  }, [stop]);

  return { gps, current, liveFix, arrived, start, end };
}
