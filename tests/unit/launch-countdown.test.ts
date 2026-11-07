import { describe, expect, it } from 'vitest';
import {
  countdownAt,
  LAUNCH_AT,
  LAUNCH_DATE,
} from '@/components/coming-soon/launch';

describe('Bangkok launch countdown', () => {
  it('uses Buddhist year 2569 as Gregorian 2026 at Thai midnight', () => {
    expect(LAUNCH_DATE).toBe('2026-11-24T00:00:00+07:00');
    expect(new Date(LAUNCH_AT).toISOString()).toBe('2026-11-23T17:00:00.000Z');
    expect(countdownAt(Date.parse('2026-11-06T12:00:00Z'))).toEqual({
      days: 17,
      hours: 5,
      minutes: 0,
      seconds: 0,
      launched: false,
    });
  });
  it('keeps the final fraction of a second pending, then reaches zero exactly', () => {
    expect(countdownAt(LAUNCH_AT - 1)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
      launched: false,
    });
    expect(countdownAt(LAUNCH_AT)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      launched: true,
    });
    expect(countdownAt(LAUNCH_AT + 86400000)).toEqual(countdownAt(LAUNCH_AT));
  });
  it('carries between days, hours and minutes without a negative field', () => {
    expect(countdownAt(LAUNCH_AT - 90061000)).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      launched: false,
    });
    expect(countdownAt(LAUNCH_AT - 60000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 0,
      launched: false,
    });
  });
});
