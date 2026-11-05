import { expect, it } from 'vitest';
import { semanticColor } from '@/theme/colors';

function luminance(hex: string) {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
}

it.each([
  ['text', 'background'],
  ['text-muted', 'background'],
  ['on-action', 'action-primary'],
  ['on-action', 'action-hover'],
  ['on-secondary', 'action-secondary'],
  ['success', 'surface'],
  ['warning', 'surface'],
  ['danger', 'surface'],
  ['information', 'surface'],
] as const)(
  'keeps %s on %s legible for normal text at WCAG AA',
  (foreground, background) => {
    const a = luminance(semanticColor(foreground));
    const b = luminance(semanticColor(background));
    expect(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  },
);
