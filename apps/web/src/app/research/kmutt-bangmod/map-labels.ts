import { places } from './places';

const landmarks = new Map([
  ['N9', 'FIBO'],
  ['N10', 'หอสมุด'],
  ['N16', 'LX'],
  ['S2-parking', 'อาคารจอดรถ'],
  ['S4-11-floors', 'วิศววัฒนะ'],
  ['sports-field', 'สนามกีฬา'],
  ['emerald-pond', 'สระมรกต'],
  ['learning-garden', 'สวนการเรียนรู้'],
  ['commemoration-park', 'สวนเฉลิมพระเกียรติ'],
]);

export const mapLabels = places
  .filter(
    ({ building, id, kind }) =>
      building || landmarks.has(id) || kind === 'gate',
  )
  .map(({ id, building, kind, nameTh, label, world }) => ({
    id,
    code:
      building?.code ??
      (kind === 'gate'
        ? nameTh.split(' ').slice(0, 2).join(' ')
        : (landmarks.get(id) ?? nameTh)),
    caption: building
      ? (landmarks.get(id) ?? nameTh.replace(/^อาคาร/, ''))
      : '',
    label,
    world,
    priority: landmarks.has(id) || kind === 'gate' ? 1 : 0,
  }))
  .sort((a, b) => b.priority - a.priority);

type Box = { left: number; top: number; right: number; bottom: number };
type Candidate = {
  id: string;
  code: string;
  x: number;
  y: number;
  area: boolean;
};

export function layoutMapLabels(
  candidates: readonly Candidate[],
  protectedPoints: readonly { x: number; y: number }[],
  width: number,
  height: number,
  detailed: boolean,
) {
  const occupied: Box[] = protectedPoints.map(({ x, y }) => ({
    left: x - 41,
    right: x + 41,
    top: y - 29,
    bottom: y + 24,
  }));
  const codes = new Set<string>();
  const labels = [];
  for (const { id, code, x, y, area } of candidates) {
    if (!detailed && codes.has(code)) continue;
    const half = detailed && !area ? 72 : area ? 54 : 19;
    const box = {
      left: x - half,
      right: x + half,
      top: y - 11,
      bottom: y + 11,
    };
    if (
      box.left < 0 ||
      box.right > width ||
      box.top < 0 ||
      box.bottom > height ||
      occupied.some(
        (other) =>
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top,
      )
    )
      continue;
    codes.add(code);
    occupied.push(box);
    labels.push({
      id,
      left: (x / width) * 100,
      top: (y / height) * 100,
      detailed: detailed && !area,
    });
  }
  return labels;
}

export type MapLabelPlacement = ReturnType<typeof layoutMapLabels>[number];
