import { useCallback, useEffect, useRef, useState } from 'react';
import { liveFixAgeMs, readLiveFix } from './live-position';

type PositionState =
  | ReturnType<typeof readLiveFix>
  | {
      status:
        | 'off'
        | 'searching'
        | 'denied'
        | 'unavailable'
        | 'unsupported'
        | 'insecure';
    };

export function useLivePosition() {
  const [state, setState] = useState<PositionState>({ status: 'off' });
  const watch = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const release = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    window.clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const leave = () => {
      release();
      setState({ status: 'off' });
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      release();
    };
  }, [release]);

  function start() {
    if (watch.current !== null) return;
    if (!window.isSecureContext) {
      setState({ status: 'insecure' });
      return;
    }
    if (!navigator.geolocation) {
      setState({ status: 'unsupported' });
      return;
    }
    setState({ status: 'searching' });
    const id = navigator.geolocation.watchPosition(
      (position) => {
        if (watch.current !== id) return;
        window.clearTimeout(timer.current);
        const now = Date.now();
        const sample = readLiveFix(position, now);
        setState(sample);
        if (sample.status === 'live') {
          timer.current = window.setTimeout(
            () => setState({ status: 'stale' }),
            liveFixAgeMs - Math.max(0, now - position.timestamp),
          );
        }
      },
      ({ code }) => {
        if (watch.current !== id) return;
        window.clearTimeout(timer.current);
        if (code === 1) {
          release();
          setState({ status: 'denied' });
        } else {
          setState({ status: 'unavailable' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
    watch.current = id;
  }

  function stop() {
    release();
    setState({ status: 'off' });
  }

  const tracking =
    state.status !== 'off' &&
    state.status !== 'denied' &&
    state.status !== 'unsupported' &&
    state.status !== 'insecure';
  return { state, tracking, start, stop };
}
