import map from './anchors.generated.json';

type Kind = 'walk' | 'road' | 'steps';
export type MapPoint = readonly [number, number];
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
  from: Endpoint & { id: string };
  to: Endpoint & { id: string };
  segments: WalkSegment[];
  metres: number;
};

export const walkingEndpoints: Readonly<Record<string, Endpoint>> =
  map.walking.endpoints;
const graph = map.walking.nodes.map((): Edge[] => []);
const positions = map.walking.nodes.map(([x, z]) => {
  if (typeof x !== 'number' || typeof z !== 'number')
    throw new Error('Invalid walking node');
  return [x, z] as const;
});
for (const [start, end, kind, direction, way] of map.walking.edges) {
  if (
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    typeof way !== 'number' ||
    (kind !== 'walk' && kind !== 'road' && kind !== 'steps')
  ) {
    throw new Error('Invalid walking edge');
  }
  const a = positions[start];
  const b = positions[end];
  if (!a || !b) throw new Error('Walking edge references a missing node');
  const metres = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const cost = metres * (kind === 'road' ? 1.2 : 1);
  if (direction !== '-1')
    graph[start]?.push({ to: end, metres, cost, kind, way });
  if (direction !== 'yes')
    graph[end]?.push({ to: start, metres, cost, kind, way });
}

export function findWalk(fromId: string, toId: string): WalkRoute | null {
  const from = Object.hasOwn(walkingEndpoints, fromId)
    ? walkingEndpoints[fromId]
    : undefined;
  const to = Object.hasOwn(walkingEndpoints, toId)
    ? walkingEndpoints[toId]
    : undefined;
  if (!from || !to || from.node === to.node) return null;
  const distance = positions.map(() => Infinity);
  const visited = new Set<number>();
  const previous = new Map<number, { start: number; edge: Edge }>();
  distance[from.node] = 0;
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
    if (current === to.node) break;
    visited.add(current);
    for (const edge of graph[current] ?? []) {
      if (best + edge.cost >= (distance[edge.to] ?? Infinity)) continue;
      distance[edge.to] = best + edge.cost;
      previous.set(edge.to, { start: current, edge });
    }
  }
  const segments: WalkSegment[] = [];
  for (let current = to.node; current !== from.node;) {
    const step = previous.get(current);
    const end = positions[current];
    const start = step && positions[step.start];
    if (!step || !start || !end) return null;
    segments.push({
      from: start,
      to: end,
      kind: step.edge.kind,
      metres: step.edge.metres,
      way: step.edge.way,
    });
    current = step.start;
  }
  segments.reverse();
  return {
    from: { ...from, id: fromId },
    to: { ...to, id: toId },
    segments,
    metres: segments.reduce((sum, segment) => sum + segment.metres, 0),
  };
}
