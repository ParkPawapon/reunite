import map from './anchors.generated.json';

type Kind = 'walk' | 'road' | 'steps';
export function walkingMinutes(metres: number) {
  return metres / 75;
}

export type MapPoint = readonly [number, number];

export function projectOnSegment(
  [x, z]: MapPoint,
  from: MapPoint,
  to: MapPoint,
) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const squaredLength = dx * dx + dz * dz;
  const fraction = squaredLength
    ? Math.max(
        0,
        Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / squaredLength),
      )
    : 0;
  const point: MapPoint = [from[0] + dx * fraction, from[1] + dz * fraction];
  return { fraction, point, distance: Math.hypot(x - point[0], z - point[1]) };
}
type Edge = {
  to: number;
  metres: number;
  cost: number;
  kind: Kind;
  way: number;
};
type Endpoint = {
  node: number;
  basis: string;
  sourceNode: number;
  gapMetres: number;
};
export type WalkSegment = {
  from: MapPoint;
  to: MapPoint;
  kind: Kind;
  metres: number;
  way: number;
};
export type WalkRoute = {
  from:
    (Endpoint & { id: string }) | { id: 'live-origin'; basis: 'live-position' };
  to: Endpoint & { id: string };
  segments: WalkSegment[];
  metres: number;
  liveOrigin?: true;
};

export const walkingEndpoints: Readonly<Record<string, Endpoint>> =
  map.walking.endpoints;
function isWalkable(kind: string): kind is Kind {
  return kind === 'walk' || kind === 'road' || kind === 'steps';
}

type GraphEdge = readonly [number, number, string, string, number];
type Path = {
  start: number;
  end: number;
  departures: { start: number; edge: Edge }[];
};

export function createWalkingGraph(
  positions: readonly MapPoint[],
  edges: readonly GraphEdge[],
) {
  const outgoing = positions.map((): Edge[] => []);
  const paths = new Map<string, Path>();
  for (const [start, end, kind, direction, way] of edges) {
    if (!isWalkable(kind)) continue;
    if (direction !== '-1' && direction !== 'yes' && direction !== 'no')
      throw new Error('Invalid walking direction');
    const a = positions[start];
    const b = positions[end];
    if (!a || !b) throw new Error('Walking edge references a missing node');
    const metres = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const cost = metres * (kind === 'road' ? 1.2 : 1);
    const key = [Math.min(start, end), Math.max(start, end)].join(':');
    const path = paths.get(key) ?? { start, end, departures: [] };
    paths.set(key, path);
    if (direction !== '-1') {
      const edge = { to: end, metres, cost, kind, way };
      outgoing[start]?.push(edge);
      path.departures.push({ start, edge });
    }
    if (direction !== 'yes') {
      const edge = { to: start, metres, cost, kind, way };
      outgoing[end]?.push(edge);
      path.departures.push({ start: end, edge });
    }
  }
  return { positions, outgoing, paths: [...paths.values()] };
}

const campusGraph = createWalkingGraph(
  map.walking.nodes.map(([x, z]) => {
    if (typeof x !== 'number' || typeof z !== 'number')
      throw new Error('Invalid walking node');
    return [x, z];
  }),
  map.walking.edges.map(([start, end, kind, direction, way]) => {
    if (
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      typeof way !== 'number' ||
      typeof kind !== 'string' ||
      !isWalkable(kind) ||
      typeof direction !== 'string'
    ) {
      throw new Error('Invalid walking edge');
    }
    return [start, end, kind, direction, way];
  }),
);

export const routeMatchRadius = (accuracy: number) => Math.max(8, accuracy);
export const matchUncertainty = (accuracy: number) =>
  Math.max(3, Math.min(12, accuracy));

type EdgeMatch = ReturnType<typeof projectOnSegment> & { path: Path };
export type WalkingEdgeMatch =
  | { status: 'matched'; match: EdgeMatch }
  | { status: 'unmatched' | 'ambiguous' };

export function matchWalkingEdge(
  point: MapPoint,
  accuracy: number,
  graph = campusGraph,
): WalkingEdgeMatch {
  const radius = routeMatchRadius(accuracy);
  const nearby = graph.paths
    .flatMap((path): EdgeMatch[] => {
      const start = graph.positions[path.start];
      const end = graph.positions[path.end];
      if (!start || !end || (start[0] === end[0] && start[1] === end[1]))
        return [];
      const projection = projectOnSegment(point, start, end);
      return projection.distance <= radius ? [{ ...projection, path }] : [];
    })
    .sort((a, b) => a.distance - b.distance);
  const closest = nearby[0];
  if (!closest) return { status: 'unmatched' };

  const uncertainty = matchUncertainty(accuracy);
  // Nearby segments linked through a junction inside the uncertainty range
  // represent the same local path. Separate corridors remain ambiguous.
  const closeNodes = new Set<number>();
  const junctions = new Map<number, number[]>();
  for (const { path } of nearby) {
    const [start, end] = [path.start, path.end];
    for (const [node, other] of [
      [start, end],
      [end, start],
    ] as const) {
      const position = graph.positions[node];
      if (
        position &&
        Math.hypot(
          position[0] - closest.point[0],
          position[1] - closest.point[1],
        ) <= uncertainty
      ) {
        const adjacent = junctions.get(node) ?? [];
        adjacent.push(other);
        junctions.set(node, adjacent);
      }
    }
  }
  const queue = [closest.path.start, closest.path.end].filter((node) =>
    junctions.has(node),
  );
  for (const node of queue) closeNodes.add(node);
  for (const node of queue) {
    for (const other of junctions.get(node) ?? []) {
      if (!junctions.has(other) || closeNodes.has(other)) continue;
      closeNodes.add(other);
      queue.push(other);
    }
  }
  if (
    nearby.some(
      ({ path, distance }) =>
        path !== closest.path &&
        distance <= closest.distance + uncertainty &&
        !closeNodes.has(path.start) &&
        !closeNodes.has(path.end),
    )
  ) {
    return { status: 'ambiguous' };
  }
  return { status: 'matched', match: closest };
}

type Departure = { node: number; cost: number; partial?: WalkSegment };

function solveWalk(
  graph: ReturnType<typeof createWalkingGraph>,
  departures: readonly Departure[],
  destination: number,
) {
  const { positions, outgoing } = graph;
  const distance = positions.map(() => Infinity);
  const visited = new Set<number>();
  const previous = new Map<number, { start: number; edge: Edge }>();
  const starts = new Map<number, WalkSegment | undefined>();
  for (const { node, cost, partial } of departures) {
    if (cost >= (distance[node] ?? Infinity)) continue;
    distance[node] = cost;
    starts.set(node, partial);
  }
  // A linear queue is sufficient for this small local graph and keeps tie breaks stable.
  while (true) {
    let current = -1;
    let best = Infinity;
    for (const [index, value] of distance.entries()) {
      if (!visited.has(index) && value < best) {
        best = value;
        current = index;
      }
    }
    if (current === -1) return null;
    if (current === destination) break;
    visited.add(current);
    for (const edge of outgoing[current] ?? []) {
      if (best + edge.cost >= (distance[edge.to] ?? Infinity)) continue;
      distance[edge.to] = best + edge.cost;
      previous.set(edge.to, { start: current, edge });
    }
  }
  const segments: WalkSegment[] = [];
  let current = destination;
  let step = previous.get(current);
  while (step) {
    const end = positions[current];
    const start = positions[step.start];
    if (!start || !end) return null;
    segments.push({
      from: start,
      to: end,
      kind: step.edge.kind,
      metres: step.edge.metres,
      way: step.edge.way,
    });
    current = step.start;
    step = previous.get(current);
  }
  const partial = starts.get(current);
  if (partial && (partial.metres > 0 || segments.length === 0))
    segments.push(partial);
  return segments.reverse();
}

function buildRoute(
  from: WalkRoute['from'],
  to: WalkRoute['to'],
  segments: WalkSegment[],
): WalkRoute {
  return {
    from,
    to,
    segments,
    metres: segments.reduce((sum, segment) => sum + segment.metres, 0),
  };
}

export function findWalk(fromId: string, toId: string): WalkRoute | null {
  const from = Object.hasOwn(walkingEndpoints, fromId)
    ? walkingEndpoints[fromId]
    : undefined;
  const to = Object.hasOwn(walkingEndpoints, toId)
    ? walkingEndpoints[toId]
    : undefined;
  if (!from || !to || from.node === to.node) return null;
  const segments = solveWalk(
    campusGraph,
    [{ node: from.node, cost: 0 }],
    to.node,
  );
  return (
    segments &&
    buildRoute({ ...from, id: fromId }, { ...to, id: toId }, segments)
  );
}

export function findWalkFromEdge(
  plan: WalkRoute,
  match: EdgeMatch,
  graph = campusGraph,
): WalkRoute | null {
  return walkFromEdge(plan.from, plan.to, match, graph);
}

export function findWalkFromPosition(
  point: MapPoint,
  accuracy: number,
  toId: string,
): WalkRoute | null {
  const to = Object.hasOwn(walkingEndpoints, toId)
    ? walkingEndpoints[toId]
    : undefined;
  if (!to) return null;
  const edge = matchWalkingEdge(point, accuracy);
  return edge.status === 'matched'
    ? walkFromEdge(
        { id: 'live-origin', basis: 'live-position' },
        { ...to, id: toId },
        edge.match,
        campusGraph,
      )
    : null;
}

function walkFromEdge(
  from: WalkRoute['from'],
  to: WalkRoute['to'],
  { path, point, fraction }: EdgeMatch,
  graph: typeof campusGraph,
): WalkRoute | null {
  const departures = path.departures.flatMap(({ start, edge }): Departure[] => {
    const end = graph.positions[edge.to];
    if (!end) return [];
    const remaining = start === path.start ? 1 - fraction : fraction;
    return [
      {
        node: edge.to,
        cost: edge.cost * remaining,
        partial: {
          from: point,
          to: end,
          metres: edge.metres * remaining,
          kind: edge.kind,
          way: edge.way,
        },
      },
    ];
  });
  // An exact endpoint can use any legal departure from that node even if this edge is one-way.
  const endpoint =
    fraction === 0 ? path.start : fraction === 1 ? path.end : null;
  const reference = departures[0]?.partial;
  if (endpoint !== null && reference)
    departures.unshift({
      node: endpoint,
      cost: 0,
      partial: { ...reference, to: point, metres: 0 },
    });
  const segments = solveWalk(graph, departures, to.node);
  return (
    segments && {
      ...buildRoute(from, to, segments),
      liveOrigin: true,
    }
  );
}
