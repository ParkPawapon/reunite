/** One launch instant, independent of the visitor's browser timezone. */
export const LAUNCH_DATE = '2026-11-24T00:00:00+07:00';
export const LAUNCH_AT = Date.parse(LAUNCH_DATE);
export const LAUNCH_DATE_LABEL = '24 พฤศจิกายน 2569';

export function countdownAt(now: number) {
  const total = Math.max(0, Math.ceil((LAUNCH_AT - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
    launched: total === 0,
  };
}
