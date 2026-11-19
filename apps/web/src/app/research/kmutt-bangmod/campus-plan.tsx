import { useRef, useState, type PointerEvent } from 'react';
import {
  campusRoutes,
  campusViewBox,
  outlines,
  placeFragment,
  placesById,
  type Place,
} from './places';
import type { LiveFix } from './live-position';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import { mapLabels } from './map-labels';
import styles from './viewer.module.css';
import type { WalkRoute } from './walking';

function routeViewBox(route: WalkRoute) {
  const points = route.segments.flatMap(({ from, to }) => [from, to]);
  const x = points.map(([east]) => east);
  const z = points.map(([, south]) => south);
  const left = Math.min(...x);
  const top = Math.min(...z);
  const right = Math.max(...x);
  const bottom = Math.max(...z);
  const width = Math.max(105, right - left + 72);
  const height = Math.max(105, bottom - top + 72);
  return [
    (left + right - width) / 2,
    (top + bottom - height) / 2,
    width,
    height,
  ].join(' ');
}

export function CampusPlan({
  place,
  route,
  liveFix,
  following,
  onSelect,
  onPan,
}: {
  place?: Place;
  route: WalkRoute | null;
  liveFix: LiveFix | null;
  following: boolean;
  onPan: () => void;
  onSelect: (id: string) => void;
}) {
  const [routeFocus, setRouteFocus] = useState(false);
  const [manualView, setManualView] = useState<string>();
  const drag = useRef<{
    id: number;
    origin: DOMPoint;
    inverse: DOMMatrix;
    box: DOMRect;
    moved: boolean;
  } | null>(null);
  const viewBox =
    liveFix && following
      ? [liveFix.point[0] - 95, liveFix.point[1] - 95, 190, 190].join(' ')
      : (manualView ??
        (route && routeFocus ? routeViewBox(route) : campusViewBox));

  function startPan(event: PointerEvent<SVGSVGElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const svg = event.currentTarget;
    const inverse = svg.getScreenCTM()?.inverse();
    if (!inverse) return;
    const { x, y, width, height } = svg.viewBox.baseVal;
    drag.current = {
      id: event.pointerId,
      origin: new DOMPoint(event.clientX, event.clientY),
      inverse,
      box: new DOMRect(x, y, width, height),
      moved: false,
    };
  }

  function movePan(event: PointerEvent<SVGSVGElement>) {
    const pan = drag.current;
    if (!pan || pan.id !== event.pointerId) return;
    const current = new DOMPoint(event.clientX, event.clientY);
    if (!pan.moved) {
      if (Math.hypot(current.x - pan.origin.x, current.y - pan.origin.y) < 5)
        return;
      pan.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      onPan();
    }
    const start = pan.origin.matrixTransform(pan.inverse);
    const end = current.matrixTransform(pan.inverse);
    const { x, y, width, height } = pan.box;
    setManualView(
      [x + start.x - end.x, y + start.y - end.y, width, height].join(' '),
    );
  }

  function finishPan(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }
  const paths: { kind: WalkRoute['segments'][number]['kind']; d: string }[] =
    [];
  for (const segment of route?.segments ?? []) {
    const last = paths.at(-1);
    if (last?.kind === segment.kind) last.d += `L${segment.to.join(',')}`;
    else
      paths.push({
        kind: segment.kind,
        d: `M${segment.from.join(',')}L${segment.to.join(',')}`,
      });
  }
  const endpoints = route
    ? ([
        [
          route.segments[0]?.from,
          route.from.id,
          'เริ่ม',
          styles.walkStart,
          -10,
        ],
        [route.segments.at(-1)?.to, route.to.id, 'ถึง', styles.walkEnd, 22],
      ] as const)
    : [];
  return (
    <div className={styles.plan}>
      <svg
        viewBox={viewBox}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onLostPointerCapture={finishPan}
        onPointerLeave={(event) => {
          if (!drag.current?.moved) finishPan(event);
        }}
        role="img"
        aria-label={
          place
            ? `แผนที่มุมสูง จุดเลือก ${place.label}`
            : 'แผนที่มุมสูง ทิศเหนือขึ้น'
        }
      >
        {outlines.map((feature) => {
          const shape =
            feature.kind === 'gate' ? (
              <circle
                cx={feature.world[0]}
                cy={feature.world[2]}
                r="6"
                className={styles.planGate}
              />
            ) : (
              <path
                d={feature.path}
                fillRule="evenodd"
                className={styles.planFeature}
                data-kind={feature.kind}
                data-selected={feature.id === place?.id}
              />
            );
          const target = placesById.get(feature.id);
          return target ? (
            <a
              key={feature.id}
              href={placeFragment(target.id)}
              tabIndex={-1}
              className={styles.planTarget}
              onClick={(event) => {
                event.preventDefault();
                onSelect(target.id);
              }}
            >
              <title>{target.label}</title>
              {shape}
            </a>
          ) : (
            <g key={feature.id}>{shape}</g>
          );
        })}
        <g className={styles.planRoutes} aria-hidden="true">
          <path d={campusRoutes.road} className={styles.planRoad} />
          <path d={campusRoutes.walk} className={styles.planWalk} />
        </g>
        <g className={styles.planLabels} aria-hidden="true">
          {mapLabels.map(({ id, code, caption, world }) =>
            id === place?.id ||
            id === route?.from.id ||
            id === route?.to.id ||
            id === 'S2-seminar' ||
            (code === 'S4' && id !== 'S4-11-floors') ? null : (
              <text
                key={id}
                x={world[0]}
                y={world[2]}
                data-area={!caption}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {code}
              </text>
            ),
          )}
        </g>
        {route && (
          <g className={styles.walkOverlay} aria-label="แนวเส้นทางเดิน">
            {paths.map(({ d }, index) => (
              <path key={index} className={styles.walkHalo} d={d} />
            ))}
            {paths.map(({ kind, d }, index) => (
              <path key={index} data-kind={kind} d={d} />
            ))}
            {endpoints.map(([point, id, label, style, dy]) => {
              if (!point) return null;
              const code = placesById.get(id)?.building?.code;
              return (
                <g key={id}>
                  <circle cx={point[0]} cy={point[1]} r="6" className={style} />
                  <text
                    x={point[0]}
                    y={point[1] + dy}
                    textAnchor="middle"
                    className={styles.walkLabel}
                  >
                    {code ? `${label} ${code}` : label}
                  </text>
                </g>
              );
            })}
          </g>
        )}
        {place && (
          <circle
            cx={place.world[0]}
            cy={place.world[2]}
            r="8"
            className={styles.planPin}
          />
        )}
        {liveFix && (
          <g
            className={styles.livePosition}
            aria-label="ตำแหน่งของฉัน"
            transform={`translate(${liveFix.point.join(' ')})`}
          >
            <circle r={liveFix.accuracy} className={styles.liveAccuracy} />
            {liveFix.heading !== null && (
              <path
                d="M0 -23L-7 -11L7 -11Z"
                transform={`rotate(${liveFix.heading})`}
              />
            )}
            <circle r="1" className={styles.liveHalo} />
            <circle r="1" className={styles.liveDot} />
          </g>
        )}
      </svg>
      <div className={styles.planFocus}>
        <Tooltip
          title={
            route && !following && !manualView && !routeFocus
              ? 'ขยายเส้นทาง'
              : 'ดูทั้งวิทยาเขต'
          }
        >
          <IconButton
            className={styles.iconControl}
            aria-label={
              route && !following && !manualView && !routeFocus
                ? 'ขยายเส้นทาง'
                : 'ดูทั้งวิทยาเขต'
            }
            onClick={() => {
              setRouteFocus(
                Boolean(route && !following && !manualView && !routeFocus),
              );
              setManualView(undefined);
              onPan();
            }}
          >
            <ShellIcon name="map" />
          </IconButton>
        </Tooltip>
      </div>
      <p>↑ เหนือ · แตะอาคารหรือประตูเพื่อปักหมุด</p>
    </div>
  );
}
