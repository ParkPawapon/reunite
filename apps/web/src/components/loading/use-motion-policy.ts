'use client';
import { useSyncExternalStore } from 'react';

function subscribeToVisibility(change: () => void) {
  document.addEventListener('visibilitychange', change);
  return () => document.removeEventListener('visibilitychange', change);
}
const isVisible = () => document.visibilityState === 'visible';
const serverVisibility = () => false;
const serverReducedMotion = () => true;
function subscribeToMotionPreference(change: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', change);
  return () => preference.removeEventListener('change', change);
}
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useMotionPolicy() {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    prefersReducedMotion,
    serverReducedMotion,
  );
  const visible = useSyncExternalStore(
    subscribeToVisibility,
    isVisible,
    serverVisibility,
  );
  return { reducedMotion, visible };
}
