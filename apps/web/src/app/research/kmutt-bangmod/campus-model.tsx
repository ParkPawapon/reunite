'use client';

import { useEffect, useRef, useState } from 'react';
import { buildings } from './catalog';
import { CampusLoading } from './campus-loading';
import { CampusPlan } from './campus-plan';
import type { LiveFix } from './live-position';
import { mapLabels } from './map-labels';
import { placesById, type Place } from './places';
import type { CampusScene, PinPosition } from './scene';
import type { WalkRoute } from './walking';
import styles from './viewer.module.css';

const knownIds = new Set(buildings.map((item) => item.featureId));

function positionMarker(marker: HTMLSpanElement | null, position: PinPosition) {
  if (!marker) return;
  marker.hidden = !position;
  if (position) {
    marker.style.left = `${position.left}%`;
    marker.style.top = `${position.top}%`;
  }
}

export function CampusModel({
  assetUrl,
  place,
  route,
  liveFix,
  following,
  onSelect,
  onBack,
}: {
  assetUrl: string;
  place?: Place;
  route: WalkRoute | null;
  liveFix: LiveFix | null;
  following: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CampusScene>(null);
  const pin = useRef<HTMLSpanElement>(null);
  const livePin = useRef<HTMLSpanElement>(null);
  const startPin = useRef<HTMLSpanElement>(null);
  const endPin = useRef<HTMLSpanElement>(null);
  const labelNodes = useRef(new Map<string, HTMLButtonElement>());
  const [showLabels, setShowLabels] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  );

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const controller = new AbortController();
    const { signal } = controller;
    void import('./scene')
      .then(async ({ mountCampusScene }) => {
        if (signal.aborted) return;
        const mounted = await mountCampusScene({
          canvas: element,
          signal,
          assetUrl,
          knownIds,
          onSelect,
          onPin(position) {
            positionMarker(pin.current, position);
          },
          onLivePin(position) {
            positionMarker(livePin.current, position);
          },
          onRoutePins(start, end) {
            positionMarker(startPin.current, start);
            positionMarker(endPin.current, end);
          },
          onMapLabels(labels) {
            const positions = new Map(labels.map((label) => [label.id, label]));
            for (const [id, node] of labelNodes.current) {
              const position = positions.get(id);
              node.hidden = !position;
              if (position) {
                node.style.left = `${position.left}%`;
                node.style.top = `${position.top}%`;
                node.dataset.detailed = String(position.detailed);
              }
            }
          },
          onContextLost() {
            scene.current?.dispose();
            scene.current = null;
            setState('unavailable');
          },
        });
        if (signal.aborted) mounted.dispose();
        else {
          scene.current = mounted;
          setState('ready');
        }
      })
      .catch(() => {
        if (!signal.aborted) setState('unavailable');
      });
    return () => {
      controller.abort();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [assetUrl, onSelect]);

  useEffect(() => {
    const view = scene.current;
    if (!view) return;
    view.select(place?.building?.featureId ?? null);
    view.locate(place?.world ?? null);
    if (!place) view.setView('perspective');
  }, [place, state]);

  useEffect(() => {
    scene.current?.setRoute(route?.segments ?? []);
  }, [route, state]);

  useEffect(() => {
    scene.current?.setLiveFix(liveFix, following);
  }, [liveFix, following, state]);

  const ready = state === 'ready';
  return (
    <>
      {ready && (
        <div className={styles.controls} aria-label="ควบคุมมุมกล้อง 3 มิติ">
          <button
            type="button"
            onClick={() => scene.current?.setView('perspective')}
          >
            ภาพรวม
          </button>
          <button type="button" onClick={() => scene.current?.setView('north')}>
            มุมสูง
          </button>
          <button
            type="button"
            aria-pressed={showLabels}
            onClick={() => setShowLabels(!showLabels)}
          >
            ชื่อบนแผนที่
          </button>
          {route && !following && (
            <button
              type="button"
              onClick={() => scene.current?.focusRoute(route.segments)}
            >
              ขยายเส้นทาง
            </button>
          )}
          <button type="button" onClick={() => scene.current?.rotate(1)}>
            หมุนซ้าย 45°
          </button>
          <button type="button" onClick={() => scene.current?.rotate(-1)}>
            หมุนขวา 45°
          </button>
          <button
            type="button"
            aria-label="ซูมเข้า"
            onClick={() => scene.current?.zoom(1)}
          >
            +
          </button>
          <button
            type="button"
            aria-label="ซูมออก"
            onClick={() => scene.current?.zoom(-1)}
          >
            −
          </button>
          <button
            type="button"
            disabled={!place}
            onClick={() => scene.current?.locate(place?.world ?? null)}
          >
            กลับไปที่หมุด
          </button>
        </div>
      )}
      <div className={styles.viewport} data-render-state={state}>
        <canvas
          ref={canvas}
          className={styles.canvas}
          tabIndex={ready ? 0 : -1}
          aria-hidden={!ready}
          aria-label="โมเดลภายนอกอาคารในวิทยาเขตบางมด"
        />
        {ready && (
          <div className={styles.mapLabels} hidden={!showLabels}>
            {mapLabels.map(({ id, label, code, caption }) => (
              <button
                key={id}
                type="button"
                tabIndex={-1}
                className={styles.mapLabel}
                data-map-label={id}
                data-area={!caption}
                aria-label={label}
                title={label}
                ref={(node) => {
                  if (node) labelNodes.current.set(id, node);
                  else labelNodes.current.delete(id);
                }}
                onClick={() => onSelect(id)}
                hidden
              >
                {code}
                {caption && <span> · {caption}</span>}
              </button>
            ))}
          </div>
        )}
        {ready && place && (
          <span className={styles.pin} ref={pin} hidden aria-hidden="true">
            {place.building?.code ?? place.nameTh}
          </span>
        )}
        {ready && (
          <span
            className={styles.livePin}
            ref={livePin}
            aria-label="ตำแหน่งของฉัน"
            role="img"
            hidden
          />
        )}
        {ready && route && (
          <>
            <span
              className={styles.startLabel}
              ref={startPin}
              hidden
              aria-hidden="true"
            >
              เริ่ม {placesById.get(route.from.id)?.building?.code}
            </span>
            <span
              className={styles.endLabel}
              ref={endPin}
              hidden
              aria-hidden="true"
            >
              ถึง {placesById.get(route.to.id)?.building?.code}
            </span>
          </>
        )}
        {state === 'loading' && <CampusLoading />}
        {state === 'unavailable' && (
          <CampusPlan
            place={place}
            route={route}
            liveFix={liveFix}
            following={following}
            onSelect={onSelect}
          />
        )}
      </div>
      {state === 'unavailable' && (
        <p role="status" className={styles.hint}>
          เปิดโมเดล 3 มิติไม่สำเร็จ กำลังแสดงแผนที่ 2 มิติ{' '}
          <button className={styles.textButton} type="button" onClick={onBack}>
            ใช้แผนที่ 2 มิติ
          </button>
        </p>
      )}
      {ready && (
        <p className={styles.hint}>
          ลากเพื่อหมุนได้รอบ 360° จากเหนือพื้น · ใช้ปุ่มหรือเลื่อนเพื่อซูม
        </p>
      )}
    </>
  );
}
