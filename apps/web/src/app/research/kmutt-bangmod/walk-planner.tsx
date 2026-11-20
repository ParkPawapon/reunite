import type { Ref } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import { mapPlaceName, places, placesById } from './places';
import { walkingEndpoints, walkingMinutes, type WalkRoute } from './walking';
import styles from './viewer.module.css';

const origins = places
  .filter((place) => Object.hasOwn(walkingEndpoints, place.id))
  .sort((a, b) => Number(b.id === 'N7') - Number(a.id === 'N7'));

export function OriginPicker({
  destination,
  headingRef,
  onSelect,
  onUseLocation,
}: {
  destination: string;
  headingRef: Ref<HTMLHeadingElement>;
  onSelect: (id: string) => void;
  onUseLocation: () => void;
}) {
  return (
    <section className={styles.planner} aria-labelledby="campus-origin">
      <h1 id="campus-origin" ref={headingRef} tabIndex={-1}>
        เลือกต้นทาง
      </h1>
      <p className={styles.walkIntro}>คุณเริ่มเดินจากตรงไหน</p>
      <button
        type="button"
        className={styles.originLocation}
        onClick={onUseLocation}
      >
        ใช้ตำแหน่งของฉัน
      </button>
      <ul className={styles.results} aria-label="เลือกอาคารต้นทาง">
        {origins
          .filter((place) => place.id !== destination)
          .map((place) => {
            const code =
              place.building?.code ??
              (place.kind === 'gate' ? 'ประตู' : 'พื้นที่');
            return (
              <li key={place.id}>
                <button type="button" onClick={() => onSelect(place.id)}>
                  <strong>{code}</strong>
                  <span>
                    {mapPlaceName(place)}
                    <small>
                      {place.building && place.building.code + ' · '}บางมด
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}

function WalkEndpoint({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.walkEndpoint}>
      <ShellIcon name="pin" />
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

export function WalkPlanner({
  route,
  startRef,
  onStart,
}: {
  route: WalkRoute;
  startRef: Ref<HTMLButtonElement>;
  onStart: () => void;
}) {
  const origin = placesById.get(route.from.id);
  const destination = placesById.get(route.to.id);
  const originCode = route.liveOrigin
    ? 'ตำแหน่งของฉัน'
    : (origin?.building?.code ?? origin?.nameTh ?? route.from.id);
  const destinationCode =
    destination?.building?.code ?? destination?.nameTh ?? route.to.id;
  return (
    <section className={styles.planner} aria-labelledby="campus-walk">
      <h1 id="campus-walk">แผนที่บางมด</h1>
      <p className={styles.walkIntro}>เลือกจุดหมาย แล้วเดินไปด้วยกัน</p>
      <div className={styles.routePreview}>
        <dl>
          <WalkEndpoint
            label="จาก"
            value={
              origin?.building
                ? originCode + ' · ' + mapPlaceName(origin)
                : originCode
            }
          />
          <WalkEndpoint
            label="ไป"
            value={
              destination?.building
                ? destinationCode + ' · ' + mapPlaceName(destination)
                : destinationCode
            }
          />
        </dl>
        <p className={styles.tripEstimate}>
          <strong>{Math.ceil(walkingMinutes(route.metres))}</strong>
          <span>นาที · เดิน</span>
          <small>ประมาณ {Math.round(route.metres / 10) * 10} ม.</small>
        </p>
        <p className={styles.walkNote}>เส้นทางตามทางเดินในมหาวิทยาลัย</p>
        <button
          className={styles.primaryAction}
          type="button"
          ref={startRef}
          onClick={onStart}
        >
          เริ่มเดิน
        </button>
      </div>
      <div className={styles.previewSteps}>
        <WalkSteps route={route} />
      </div>
      <p className={styles.mobileWalkNotice}>
        ตำแหน่งทางเข้าบางจุดยังต้องสำรวจ
      </p>
    </section>
  );
}

export function WalkSteps({ route }: { route: WalkRoute }) {
  const start = placesById.get(route.from.id);
  const destination = placesById.get(route.to.id);
  return (
    <div className={styles.walkSteps}>
      <h2>เส้นทางเดิน</h2>
      <ol>
        <li>
          <ShellIcon name="pin" />
          <div>
            <strong>
              {route.liveOrigin
                ? 'เริ่มจากตำแหน่งบนแผนที่'
                : 'เริ่มใกล้ ' +
                  (start?.building?.code ?? start?.nameTh ?? route.from.id)}
            </strong>
            <p>ไปตามเส้นทางสีส้ม</p>
          </div>
        </li>
        <li>
          <ShellIcon name="pin" />
          <div>
            <strong>
              ถึงบริเวณ{' '}
              {destination?.building?.code ??
                destination?.nameTh ??
                route.to.id}
            </strong>
            <p>ตรวจป้ายและทางเข้าหน้างานอีกครั้ง</p>
          </div>
        </li>
      </ol>
      <p className={styles.walkNotice}>
        <ShellIcon name="alert" /> ตำแหน่งทางเข้าบางจุดยังต้องสำรวจ
      </p>
    </div>
  );
}
