import { walkProgress, type LiveFix, type WalkProgress } from './live-position';
import {
  findWalkFromEdge,
  matchWalkingEdge,
  type WalkRoute,
  type WalkingEdgeMatch,
} from './walking';

// A short run of distinct, trusted off-route fixes filters single GPS jumps.
export const deviationSamplesRequired = 3;

type RerouteRequest = { fix: LiveFix; edge: WalkingEdgeMatch };
export type WalkSession = {
  plan: WalkRoute;
  route: WalkRoute;
  progress: WalkProgress | null;
  deviations: number;
  phase: 'walking' | 'rerouting' | 'recovery' | 'arrived';
  request: RerouteRequest | null;
};

export function startWalkSession(plan: WalkRoute): WalkSession {
  return {
    plan,
    route: plan,
    progress: null,
    deviations: 0,
    phase: 'walking',
    request: null,
  };
}

export function advanceWalk(
  session: WalkSession,
  fix: LiveFix | null,
): WalkSession {
  if (session.phase === 'arrived' || session.phase === 'recovery')
    return session;
  if (!fix)
    return {
      ...session,
      progress: null,
      deviations: 0,
      phase: 'walking',
      request: null,
    };

  const edge = matchWalkingEdge(fix.point, fix.accuracy);
  const progress = walkProgress(session.route, fix, edge);
  if (progress.status === 'near-destination') {
    return { ...session, progress, phase: 'arrived', request: null };
  }
  if (progress.status !== 'away' || edge.status === 'ambiguous') {
    return {
      ...session,
      progress:
        edge.status === 'ambiguous' && progress.status === 'away'
          ? { status: 'ambiguous' }
          : progress,
      deviations: 0,
      phase: 'walking',
      request: null,
    };
  }
  if (session.request) return session;

  const deviations = session.deviations + 1;
  return deviations < deviationSamplesRequired
    ? { ...session, progress, deviations }
    : {
        ...session,
        progress,
        deviations,
        phase: 'rerouting',
        request: { fix, edge },
      };
}

export function resolveReroute(session: WalkSession): WalkSession {
  if (!session.request) return session;
  const { fix, edge } = session.request;
  const route =
    edge.status === 'matched'
      ? findWalkFromEdge(session.plan, edge.match)
      : null;
  if (!route)
    return { ...session, phase: 'recovery', request: null, progress: null };
  const progress = walkProgress(route, fix, edge);
  return {
    ...session,
    route,
    progress,
    phase: progress.status === 'near-destination' ? 'arrived' : 'walking',
    deviations: 0,
    request: null,
  };
}
