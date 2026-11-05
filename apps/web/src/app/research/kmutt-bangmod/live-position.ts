import map from './anchors.generated.json';
import type { MapPoint, WalkRoute } from './walking';

export type LiveFix = {
  point: MapPoint;
  accuracy: number;
  heading: number | null;
};

export const liveFixAgeMs = 30_000;
const projection = map.liveProjection;
const [left = 0, top = 0, width = 0, height = 0] = map.viewBox;

type PositionSample = {
  timestamp: number;
  coords: Pick<
    GeolocationCoordinates,
    'latitude' | 'longitude' | 'accuracy' | 'speed' | 'heading'
  >;
};

export function readLiveFix(position: PositionSample, now: number) {
  const { latitude, longitude, accuracy, speed, heading } = position.coords;
  if (
    ![latitude, longitude, accuracy, position.timestamp].every(
      Number.isFinite,
    ) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    accuracy < 0 ||
    Math.abs(now - position.timestamp) >= liveFixAgeMs
  ) {
    return { status: 'stale' } as const;
  }
  if (accuracy > 100) return { status: 'imprecise' } as const;

  const dLon = longitude - projection.origin.lon;
  const dLat = latitude - projection.origin.lat;
  const x = dLon * projection.longitude.x + dLat * projection.latitude.x;
  const z = dLon * projection.longitude.z + dLat * projection.latitude.z;
  if (x < left || x > left + width || z < top || z > top + height) {
    return { status: 'outside' } as const;
  }
  const fix: LiveFix = {
    point: [x, z],
    accuracy,
    heading:
      speed !== null &&
      Number.isFinite(speed) &&
      speed >= 0.55 &&
      heading !== null &&
      Number.isFinite(heading) &&
      heading >= 0 &&
      heading < 360
        ? heading
        : null,
  };
  return { status: 'live', fix } as const;
}

export function walkProgress(route: WalkRoute, fix: LiveFix) {
  if (fix.accuracy > 25) return { status: 'imprecise' } as const;
  const [x, z] = fix.point;
  let travelled = 0;
  const candidates = route.segments.map(({ from, to, metres }) => {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const fraction = Math.max(
      0,
      Math.min(
        1,
        ((x - from[0]) * dx + (z - from[1]) * dz) / (metres * metres),
      ),
    );
    const distance = Math.hypot(
      x - from[0] - fraction * dx,
      z - from[1] - fraction * dz,
    );
    const along = travelled + metres * fraction;
    travelled += metres;
    return { distance, along };
  });
  candidates.sort((a, b) => a.distance - b.distance);
  const closest = candidates[0];
  if (!closest || closest.distance > Math.max(8, fix.accuracy)) {
    return { status: 'away' } as const;
  }
  if (
    candidates.some(
      ({ distance, along }) =>
        distance <=
          closest.distance + Math.max(3, Math.min(12, fix.accuracy)) &&
        Math.abs(along - closest.along) > 35,
    )
  ) {
    return { status: 'ambiguous' } as const;
  }
  const remaining = Math.max(0, route.metres - closest.along);
  const end = route.segments.at(-1)?.to;
  if (
    end &&
    remaining <= 10 &&
    Math.hypot(x - end[0], z - end[1]) + fix.accuracy <= 14
  ) {
    return { status: 'near-destination' } as const;
  }
  return { status: 'on-route', remaining } as const;
}
