import { useCallback, useEffect, useRef, useState } from 'react';
import { liveFixAgeMs, readLiveFix } from './live-position';

type PositionState =
  | ReturnType<typeof readLiveFix>
  | {
      status:
        | 'off'
        | 'requesting'
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

  function start(
    onSample?: (sample: ReturnType<typeof readLiveFix> | null) => void,
  ) {
    if (watch.current !== null) return;
    if (!window.isSecureContext) {
      setState({ status: 'insecure' });
      return;
    }
    if (!navigator.geolocation) {
      setState({ status: 'unsupported' });
      return;
    }
    setState({ status: navigator.permissions ? 'requesting' : 'searching' });
    let latestTimestamp = -Infinity;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        if (watch.current !== id || position.timestamp <= latestTimestamp)
          return;
        window.clearTimeout(timer.current);
        const now = Date.now();
        const sample = readLiveFix(position, now);
        if (
          Number.isFinite(position.timestamp) &&
          Math.abs(now - position.timestamp) < liveFixAgeMs
        ) {
          latestTimestamp = position.timestamp;
        }
        setState(sample);
        onSample?.(sample);
        if (sample.status === 'live') {
          timer.current = window.setTimeout(
            () => {
              setState({ status: 'stale' });
              onSample?.(null);
            },
            liveFixAgeMs - Math.max(0, now - position.timestamp),
          );
        }
      },
      ({ code }) => {
        if (watch.current !== id) return;
        window.clearTimeout(timer.current);
        onSample?.(null);
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
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then(({ state: permission }) => {
        if (watch.current !== id || permission !== 'granted') return;
        setState((current) =>
          current.status === 'requesting' ? { status: 'searching' } : current,
        );
      })
      .catch(() => {
        if (watch.current === id)
          setState((current) =>
            current.status === 'requesting' ? { status: 'searching' } : current,
          );
      });
  }

  const stop = useCallback(() => {
    release();
    setState({ status: 'off' });
  }, [release]);

  return { state, start, stop };
}
