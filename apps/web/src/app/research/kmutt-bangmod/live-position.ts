import map from './anchors.generated.json';
import {
  matchUncertainty,
  projectOnSegment,
  routeMatchRadius,
  type MapPoint,
  type WalkingEdgeMatch,
  type WalkRoute,
} from './walking';

export type LiveFix = {
  point: MapPoint;
  accuracy: number;
  heading: number | null;
  stationary?: boolean;
};

export const maxLiveAccuracy = 25;
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
  if (accuracy > maxLiveAccuracy) return { status: 'imprecise' } as const;

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
    stationary: speed === 0,
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

type MatchedProgress = {
  status: 'on-route' | 'near-destination';
  remaining: number;
  completed: WalkRoute['segments'];
  remainingSegments: WalkRoute['segments'];
  travelled: number;
  matchedPoint: MapPoint;
};
export type WalkProgress =
  MatchedProgress | { status: 'imprecise' | 'away' | 'ambiguous' };

export function walkProgress(
  route: WalkRoute,
  fix: LiveFix,
  edgeMatch?: WalkingEdgeMatch,
): WalkProgress {
  if (fix.accuracy > maxLiveAccuracy) return { status: 'imprecise' } as const;
  const [x, z] = fix.point;
  let travelled = 0;
  const candidates = route.segments.map((segment, index) => {
    const match = projectOnSegment(fix.point, segment.from, segment.to);
    const along = travelled + segment.metres * match.fraction;
    travelled += segment.metres;
    return { ...match, segment, along, index };
  });
  candidates.sort((a, b) => a.distance - b.distance);
  const closest = candidates[0];
  if (!closest || closest.distance > routeMatchRadius(fix.accuracy)) {
    return { status: 'away' } as const;
  }
  if (
    edgeMatch?.status === 'matched' &&
    closest.distance > edgeMatch.match.distance + matchUncertainty(fix.accuracy)
  ) {
    return { status: 'away' };
  }
  if (
    edgeMatch?.status === 'ambiguous' ||
    candidates.some(
      ({ distance, along }) =>
        distance <= closest.distance + matchUncertainty(fix.accuracy) &&
        Math.abs(along - closest.along) > 35,
    )
  ) {
    return { status: 'ambiguous' } as const;
  }
  const remaining = Math.max(0, route.metres - closest.along);
  const end = route.segments.at(-1)?.to;
  const nearDestination =
    end &&
    remaining <= 10 &&
    Math.hypot(x - end[0], z - end[1]) + fix.accuracy <= 14;
  const { segment, fraction, point, index, along } = closest;
  const completed = route.segments.slice(0, index);
  const remainingSegments = route.segments.slice(index + 1);
  if (fraction > 0)
    completed.push({
      ...segment,
      to: point,
      metres: segment.metres * fraction,
    });
  if (fraction < 1)
    remainingSegments.unshift({
      ...segment,
      from: point,
      metres: segment.metres * (1 - fraction),
    });
  return {
    status: nearDestination ? 'near-destination' : 'on-route',
    remaining,
    completed,
    remainingSegments,
    travelled: along,
    matchedPoint: point,
  } as const;
}
