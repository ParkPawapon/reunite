import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
import {
  campusRoutes,
  campusViewBox,
  outlines,
  placeFragment,
  placesById,
  type Place,
} from './places';
import { useSmoothPosition } from './use-smooth-position';
import type { LiveFix, WalkProgress } from './live-position';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import { mapLabels } from './map-labels';
import styles from './viewer.module.css';
import type { MapPoint, WalkRoute } from './walking';

function routeViewBox(route: WalkRoute, destination?: MapPoint) {
  const points = route.segments.flatMap(({ from, to }) => [from, to]);
  if (points.length === 0 && destination) points.push(destination);
  if (points.length === 0) return campusViewBox.split(' ').map(Number);
  const x = points.map(([east]) => east);
  const z = points.map(([, south]) => south);
  const left = Math.min(...x);
  const top = Math.min(...z);
  const right = Math.max(...x);
  const bottom = Math.max(...z);
  const width = Math.max(105, right - left + 138);
  const height = Math.max(105, bottom - top + 138);
  return [
    (left + right - width) / 2,
    (top + bottom - height) / 2,
    width,
    height,
  ];
}

function routePaths(segments: readonly WalkRoute['segments'][number][]) {
  const paths: { kind: WalkRoute['segments'][number]['kind']; d: string }[] =
    [];
  for (const segment of segments) {
    const last = paths.at(-1);
    if (last?.kind === segment.kind) last.d += 'L' + segment.to.join(',');
    else
      paths.push({
        kind: segment.kind,
        d: 'M' + segment.from.join(',') + 'L' + segment.to.join(','),
      });
  }
  return paths;
}

function fittedView(bounds: readonly number[], aspect: number, upper = false) {
  const [x = 0, y = 0, width = 1, height = 1] = bounds;
  const nextWidth = Math.max(width, height * aspect);
  const nextHeight = nextWidth / aspect;
  return [
    x + (width - nextWidth) / 2,
    y + height / 2 - nextHeight * (upper ? 0.2 : 0.5),
    nextWidth,
    nextHeight,
  ].join(' ');
}

export type FollowAction = { enabled: boolean; onClick: () => void };

export function CampusPlan({
  place,
  route,
  liveFix,
  following,
  onSelect,
  onPan,
  progress,
  navigating,
  arrived = false,
  followAction,
}: {
  place?: Place;
  route: WalkRoute | null;
  liveFix: LiveFix | null;
  following: boolean;
  onPan: () => void;
  progress: WalkProgress | null;
  navigating: boolean;
  arrived?: boolean;
  followAction?: FollowAction;
  onSelect: (id: string) => void;
}) {
  const [routeFocus, setRouteFocus] = useState(true);
  const [size, setSize] = useState({ width: 800, height: 800, mobile: false });
  const [manualView, setManualView] = useState<string>();
  const drag = useRef<{
    id: number;
    origin: DOMPoint;
    inverse: DOMMatrix;
    box: DOMRect;
    moved: boolean;
  } | null>(null);
  const upper = navigating && size.mobile;
  const aspect = size.width / size.height;
  const destination = route ? placesById.get(route.to.id) : undefined;
  const destinationPoint: MapPoint | undefined =
    route?.segments.at(-1)?.to ??
    (destination ? [destination.world[0], destination.world[2]] : undefined);
  const viewBox =
    manualView ??
    fittedView(
      route && routeFocus
        ? routeViewBox(route, destinationPoint)
        : campusViewBox.split(' ').map(Number),
      aspect,
      upper && routeFocus,
    );
  const mapElement = useRef<SVGSVGElement>(null);
  const marker = useRef<SVGGElement>(null);
  const scaleLine = useRef<HTMLSpanElement>(null);
  const scaleText = useRef<HTMLSpanElement>(null);
  const arrivalPoint = arrived ? destinationPoint : undefined;
  useLayoutEffect(() => {
    const element = mapElement.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || !entry.contentRect.width || !entry.contentRect.height)
        return;
      const { width, height } = entry.contentRect;
      setSize({
        width,
        height,
        mobile: window.matchMedia('(max-width: 999px)').matches,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const drawPosition = useCallback(
    (fix: LiveFix | null) => {
      if (fix)
        marker.current?.setAttribute(
          'transform',
          'translate(' + fix.point.join(' ') + ')',
        );
      const element = mapElement.current;
      if (!element) return;
      const point = fix?.point ?? arrivalPoint;
      const followHeight = upper ? 350 : 190;
      const followWidth = followHeight * Math.min(aspect, 1);
      if (!following || point) {
        const nextView =
          following && point
            ? fittedView(
                [
                  point[0] - followWidth / 2,
                  point[1] - followHeight / 2,
                  followWidth,
                  followHeight,
                ],
                aspect,
                upper,
              )
            : viewBox;
        element.setAttribute('viewBox', nextView);
      }
      const pixelsPerMetre = size.width / element.viewBox.baseVal.width;
      const metres =
        [100, 50, 25, 10, 5].find((step) => step * pixelsPerMetre <= 210) ?? 2;
      if (scaleLine.current)
        scaleLine.current.style.width = metres * pixelsPerMetre + 'px';
      if (scaleText.current) scaleText.current.textContent = metres + ' ม.';
      element.style.setProperty(
        '--map-label-scale',
        String(1 / pixelsPerMetre),
      );
    },
    [arrivalPoint, aspect, following, size.width, upper, viewBox],
  );
  useSmoothPosition(liveFix, drawPosition);

  function zoom(factor: number) {
    const box = mapElement.current?.viewBox.baseVal;
    if (!box) return;
    const { x, y, width, height } = box;
    const nextHeight = Math.min(1400, Math.max(70, height * factor));
    const nextWidth = (width * nextHeight) / height;
    const anchor = upper ? 0.2 : 0.5;
    onPan();
    setManualView(
      [
        x + (width - nextWidth) / 2,
        y + (height - nextHeight) * anchor,
        nextWidth,
        nextHeight,
      ].join(' '),
    );
  }

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
  function panWithKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (event.key === 'Home') {
      event.preventDefault();
      setRouteFocus(false);
      setManualView(undefined);
      onPan();
      return;
    }
    if (event.key === '+' || event.key === '-' || event.key === '=') {
      event.preventDefault();
      zoom(event.key === '-' ? 1.25 : 0.8);
      return;
    }
    const { x, y, width, height } = event.currentTarget.viewBox.baseVal;
    const horizontal =
      Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft');
    const vertical =
      Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp');
    if (!horizontal && !vertical) return;
    event.preventDefault();
    onPan();
    setManualView(
      [
        x + (horizontal * width) / 10,
        y + (vertical * height) / 10,
        width,
        height,
      ].join(' '),
    );
  }

  const matched = progress && 'remaining' in progress ? progress : null;
  const paths = [
    ...routePaths(matched?.completed ?? []).map((path) => ({
      ...path,
      phase: 'completed',
    })),
    ...routePaths(matched?.remainingSegments ?? route?.segments ?? []).map(
      (path) => ({ ...path, phase: navigating ? 'remaining' : undefined }),
    ),
  ];
  const endpoints = route
    ? ([
        [
          route.segments[0]?.from,
          route.liveOrigin ? 'live-origin' : route.from.id,
          route.liveOrigin ? 'เริ่มใหม่' : 'เริ่ม',
          styles.walkStart,
          -10,
        ],
        [destinationPoint, route.to.id, 'ถึง', styles.walkEnd, 22],
      ] as const)
    : [];
  return (
    <div className={styles.plan}>
      <svg
        ref={mapElement}
        viewBox={viewBox}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onLostPointerCapture={finishPan}
        onPointerLeave={(event) => {
          if (!drag.current?.moved) finishPan(event);
        }}
        tabIndex={0}
        onKeyDown={panWithKeyboard}
        aria-describedby="campus-map-instructions"
        role="group"
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
          <path d={campusRoutes.road} className={styles.planRoadEdge} />
          <path d={campusRoutes.road} className={styles.planRoad} />
          <path d={campusRoutes.walk} className={styles.planWalkEdge} />
          <path d={campusRoutes.walk} className={styles.planWalk} />
        </g>
        <g className={styles.planLabels} aria-hidden="true">
          {mapLabels.map(({ id, code, world }) =>
            id === place?.id ||
            id === route?.from.id ||
            id === route?.to.id ||
            code.startsWith('ประตู') ||
            ['S2-seminar', 'N13', 'N18', 'S1', 'S11'].includes(id) ? null : (
              <g
                key={id}
                transform={'translate(' + world[0] + ' ' + world[2] + ')'}
              >
                <g className={styles.planLabel}>
                  <rect
                    x={-Math.max(28, code.length * 7) / 2}
                    y={-10}
                    width={Math.max(28, code.length * 7)}
                    height={20}
                    rx={5}
                  />
                  <text textAnchor="middle" dominantBaseline="central">
                    {code}
                  </text>
                </g>
              </g>
            ),
          )}
        </g>
        {route && (
          <g className={styles.walkOverlay} aria-label="แนวเส้นทางเดิน">
            {paths.map(({ d }, index) => (
              <path key={index} className={styles.walkHalo} d={d} />
            ))}
            {paths.map(({ kind, d, phase }, index) => (
              <path key={index} data-kind={kind} data-phase={phase} d={d} />
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
            ref={marker}
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
      <div className={styles.planFocus} aria-label="ควบคุมแผนที่" role="group">
        <Tooltip title="ซูมเข้า">
          <IconButton aria-label="ซูมเข้า" onClick={() => zoom(0.8)}>
            <ShellIcon name="plus" />
          </IconButton>
        </Tooltip>
        <Tooltip title="ซูมออก">
          <IconButton aria-label="ซูมออก" onClick={() => zoom(1.25)}>
            <ShellIcon name="minus" />
          </IconButton>
        </Tooltip>
        {followAction && (
          <Tooltip title="ตามตำแหน่งฉัน">
            <span>
              <IconButton
                aria-label="ตามตำแหน่งฉัน"
                aria-pressed={following}
                disabled={!followAction.enabled}
                onClick={followAction.onClick}
              >
                <ShellIcon name="target" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <span role="img" aria-label="ทิศเหนือ" className={styles.compass}>
          N
        </span>
      </div>
      <div className={styles.mapScale} aria-hidden="true">
        <div>
          <span ref={scaleLine} />
          <span ref={scaleText}>100 ม.</span>
        </div>
        <small>© OpenStreetMap · Overture Maps</small>
      </div>
      <p id="campus-map-instructions" className={styles.srOnly}>
        ↑ เหนือ · แตะอาคารเพื่อปักหมุด
        <span className={styles.srOnly}>
          {' '}
          ใช้ปุ่มลูกศรเพื่อเลื่อนแผนที่ และปุ่ม Home เพื่อดูทั้งวิทยาเขต
        </span>
      </p>
    </div>
  );
}
