'use client';
import { useSyncExternalStore } from 'react';
import { LAUNCH_AT } from './launch';

let snapshot: number | null = null;
let interval: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function stop() {
  clearInterval(interval);
  interval = undefined;
}
function tick() {
  snapshot = Date.now();
  listeners.forEach((listener) => listener());
  if (snapshot >= LAUNCH_AT) stop();
}
function reconcile() {
  stop();
  tick();
  if (!document.hidden && Date.now() < LAUNCH_AT)
    interval = setInterval(tick, 250);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', reconcile);
    reconcile();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stop();
      document.removeEventListener('visibilitychange', reconcile);
      snapshot = null;
    }
  };
}
const getSnapshot = () => snapshot;
const getServerSnapshot = () => null;

/** Stable SSR placeholders; the browser clock starts after subscription. */
export function useLaunchClock() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
