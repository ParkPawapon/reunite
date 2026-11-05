import { places, placesById } from './places';
import { walkingEndpoints, type WalkRoute } from './walking';
import styles from './viewer.module.css';

const choices = places.filter((place) =>
  Object.hasOwn(walkingEndpoints, place.id),
);
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const segmentDistance = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 1,
});
const basis: Record<string, string> = {
  approach: 'จุดบนทางเดินใกล้อาคารหรือพื้นที่',
  'mapped-entrance': 'ทางเข้าอาคารตามแผนที่',
  'mapped-gate': 'จุดประตูวิทยาเขตตามแผนที่',
};
const routeKinds = [
  ['walk', 'ทางเดิน'],
  ['road', 'ถนนใช้ร่วมกับรถ'],
  ['steps', 'บันได'],
] as const;

export function WalkPlanner({
  from,
  to,
  route,
  onWalk,
  onClear,
}: {
  from: string;
  to: string;
  route: WalkRoute | null;
  onWalk: (from: string, to: string) => void;
  onClear: () => void;
}) {
  const totals = { walk: 0, road: 0, steps: 0 };
  for (const segment of route?.segments ?? [])
    totals[segment.kind] += segment.metres;
  return (
    <section className={styles.planner} aria-labelledby="campus-walk">
      <h2 id="campus-walk">วางแผนเดินในวิทยาเขต</h2>
      <form
        key={`${from}:${to}`}
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          onWalk(String(values.get('from')), String(values.get('to')));
        }}
      >
        <label>
          ต้นทาง{' '}
          <select name="from" defaultValue={from} required>
            <option value="">เลือกต้นทาง</option>
            {choices.map((place) => (
              <option value={place.id} key={place.id}>
                {place.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          ปลายทาง{' '}
          <select name="to" defaultValue={to} required>
            <option value="">เลือกปลายทาง</option>
            {choices.map((place) => (
              <option value={place.id} key={place.id}>
                {place.label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.controls}>
          <button type="submit">แสดงเส้นทางเดิน</button>
          <button type="button" onClick={() => onWalk('N7', 'S3')}>
            ลอง N7 → S3
          </button>
          {(from || to) && (
            <button type="button" onClick={onClear}>
              ล้างเส้นทาง
            </button>
          )}
        </div>
      </form>
      <div aria-live="polite">
        {route ? (
          <>
            <p className={styles.routeSummary}>
              <strong>{number.format(route.metres)} ม.</strong> · ประมาณ{' '}
              {Math.max(1, Math.ceil(route.metres / 75))} นาที
            </p>
            <ul
              className={styles.routeLegend}
              aria-label="ระยะทางตามประเภททางเดิน"
            >
              {routeKinds.map(
                ([kind, label]) =>
                  totals[kind] > 0 && (
                    <li key={kind} data-kind={kind}>
                      {label} {segmentDistance.format(totals[kind])} ม.
                    </li>
                  ),
              )}
            </ul>
            <p>
              <strong>เริ่ม</strong> {placesById.get(from)?.label} ·{' '}
              <a
                href={`https://www.openstreetmap.org/node/${route.from.sourceNode}`}
              >
                {basis[route.from.basis]}
              </a>
              {route.from.basis === 'approach' && (
                <>
                  {' '}
                  · ห่างขอบพื้นที่ประมาณ{' '}
                  {segmentDistance.format(route.from.gapMetres)} ม.
                </>
              )}
            </p>
            <p>
              <strong>ถึง</strong> {placesById.get(to)?.label} ·{' '}
              <a
                href={`https://www.openstreetmap.org/node/${route.to.sourceNode}`}
              >
                {basis[route.to.basis]}
              </a>
              {route.to.basis === 'approach' && (
                <>
                  {' '}
                  · ห่างขอบพื้นที่ประมาณ{' '}
                  {segmentDistance.format(route.to.gapMetres)} ม.
                </>
              )}
            </p>
            <p className={styles.hint}>ตรวจป้ายและสภาพทางหน้างาน</p>
          </>
        ) : from && to ? (
          <p role="status">
            {from === to
              ? 'เลือกต้นทางและปลายทางคนละจุด'
              : 'ยังไม่มีทางเดินที่เชื่อมสองจุดนี้ในชุดข้อมูล'}
          </p>
        ) : (
          <p className={styles.hint}>
            ใช้แนวทางเดินและถนนที่ทำแผนที่ไว้
            ระยะถึงจุดใกล้อาคารหรือทางเข้าที่มีข้อมูล
          </p>
        )}
      </div>
    </section>
  );
}
