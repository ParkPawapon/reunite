import { useCallback, useEffect, useState } from 'react';
import {
  advanceWalk,
  resolveReroute,
  startWalkSession,
  type WalkSession,
} from './walk-navigation';
import { useLivePosition } from './use-live-position';
import type { WalkRoute } from './walking';

export function useWalkNavigation(plan: WalkRoute | null) {
  const [session, setSession] = useState<WalkSession | null>(null);
  const gps = useLivePosition();
  const { stop } = gps;
  const current = session && session.plan === plan ? session : null;
  const arrived = current?.phase === 'arrived';
  const liveFix =
    current && !arrived && gps.state.status === 'live' ? gps.state.fix : null;

  useEffect(() => () => stop(), [plan, stop]);
  useEffect(() => {
    if (arrived) stop();
  }, [arrived, stop]);

  const request = current?.request;
  useEffect(() => {
    if (!request) return;
    // Allow the recalculating state to render before running the local graph search.
    const timer = window.setTimeout(() => {
      setSession((previous) =>
        previous?.request === request ? resolveReroute(previous) : previous,
      );
    }, 150);
    return () => window.clearTimeout(timer);
  }, [request]);

  function start() {
    if (!plan) return;
    stop();
    setSession(startWalkSession(plan));
    gps.start((sample) => {
      setSession((previous) => {
        if (!previous || previous.plan !== plan) return previous;
        return advanceWalk(
          previous,
          sample?.status === 'live' ? sample.fix : null,
        );
      });
    });
  }

  const end = useCallback(() => {
    stop();
    setSession(null);
  }, [stop]);

  useEffect(() => {
    window.addEventListener('pagehide', end);
    return () => window.removeEventListener('pagehide', end);
  }, [end]);

  return { gps, current, liveFix, arrived, start, end };
}
