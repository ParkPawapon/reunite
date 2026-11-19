import { campusRoutes, outlines } from '@/app/research/kmutt-bangmod/places';
import type { WalkRoute } from '@/app/research/kmutt-bangmod/walking';
import styles from './landing.module.css';

export function StoryRoute({ route }: { route: WalkRoute }) {
  const start = route.segments[0]?.from;
  const end = route.segments.at(-1)?.to;
  if (!start || !end) return null;
  const path = `M${start.join(',')}${route.segments.map(({ to }) => `L${to.join(',')}`).join('')}`;
  const points = [start, ...route.segments.map(({ to }) => to)];
  const x = points.map(([east]) => east);
  const y = points.map(([, south]) => south);
  const width = Math.max(420, Math.max(...x) - Math.min(...x) + 100);
  const height = Math.max(395, Math.max(...y) - Math.min(...y) + 90);
  const viewBox = [
    (Math.max(...x) + Math.min(...x) - width) / 2,
    (Math.max(...y) + Math.min(...y) - height) / 2,
    width,
    height,
  ].join(' ');

  return (
    <figure className={styles.routeCard} data-route-map>
      <figcaption>
        <span>
          {route.from.id} <span className={styles.routeDash}>→</span>{' '}
          {route.to.id}
        </span>
        <span>ประมาณ {Math.round(route.metres)} ม.</span>
      </figcaption>
      <svg viewBox={viewBox} className={styles.routeMap} aria-hidden="true">
        <g className={styles.mapBuildings}>
          {outlines.map(({ id, kind, path: outline }) =>
            outline &&
            (kind === 'building' || kind === 'water' || kind === 'sport') ? (
              <path key={id} d={outline} data-kind={kind} />
            ) : null,
          )}
        </g>
        <path d={campusRoutes.road} className={styles.mapRoad} />
        <path d={path} className={styles.routeUnderlay} />
        <path
          d={path}
          pathLength="1"
          className={styles.walkLine}
          data-walk-line
        />
        <g transform={`translate(${start.join(' ')})`}>
          <circle r="7" className={styles.mapStart} />
          <text x="-14" y="5" textAnchor="end">
            {route.from.id}
          </text>
        </g>
        <g transform={`translate(${end.join(' ')})`}>
          <circle r="8" className={styles.mapEnd} />
          <text x="20" y="6">
            {route.to.id}
          </text>
        </g>
      </svg>
    </figure>
  );
}
