import { walkProgress } from './live-position';
import type { useLivePosition } from './use-live-position';
import type { WalkRoute } from './walking';
import styles from './viewer.module.css';

const messages = {
  off: 'ตำแหน่งสดใช้เฉพาะบนอุปกรณ์และเริ่มเมื่อคุณอนุญาต',
  searching: 'กำลังรอสัญญาณตำแหน่งจากอุปกรณ์…',
  live: 'กำลังแสดงตำแหน่งสด',
  denied:
    'ยังไม่ได้รับสิทธิ์ตำแหน่ง เปิดสิทธิ์ของเว็บไซต์ในเบราว์เซอร์แล้วลองอีกครั้ง',
  unavailable: 'ยังรับตำแหน่งไม่ได้ กำลังรอสัญญาณใหม่',
  unsupported: 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง',
  insecure: 'ตำแหน่งสดต้องเปิดเว็บผ่าน HTTPS หรือ localhost',
  imprecise: 'ความคลาดเคลื่อนเกิน 100 ม. รอตำแหน่งที่แม่นยำขึ้น',
  stale: 'ตำแหน่งหมดอายุ กำลังรอตำแหน่งใหม่',
  outside: 'ตำแหน่งอยู่นอกขอบเขตแผนที่วิทยาเขต',
};
const progressMessages = {
  imprecise: 'สัญญาณยังไม่แม่นพอสำหรับคำนวณระยะที่เหลือ',
  away: 'ตำแหน่งอยู่นอกแนวเส้นทางที่เลือก ตรวจตำแหน่งบนแผนที่',
  ambiguous: 'มีแนวเส้นทางใกล้กันหลายช่วง รอตำแหน่งที่ชัดขึ้น',
  'near-destination': 'ตำแหน่ง GPS อยู่ใกล้จุดหมาย',
};
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

export function LocationControls({
  gps,
  route,
  following,
  onFollow,
}: {
  gps: ReturnType<typeof useLivePosition>;
  route: WalkRoute | null;
  following: boolean;
  onFollow: () => void;
}) {
  const fix = gps.state.status === 'live' ? gps.state.fix : null;
  const progress = fix && route ? walkProgress(route, fix) : null;
  return (
    <div className={styles.locationPanel}>
      <div className={styles.controls}>
        <button type="button" onClick={gps.tracking ? gps.stop : gps.start}>
          {gps.tracking ? 'หยุดแสดงตำแหน่ง' : 'แสดงตำแหน่งของฉัน'}
        </button>
        {fix && (
          <button type="button" aria-pressed={following} onClick={onFollow}>
            ให้แผนที่ตามตำแหน่ง
          </button>
        )}
      </div>
      <p role="status">{messages[gps.state.status]}</p>
      {fix && (
        <p>
          <span className={styles.liveKey} /> ความคลาดเคลื่อนประมาณ{' '}
          {number.format(Math.ceil(fix.accuracy))} ม.
          {progress &&
            (progress.status === 'on-route'
              ? ` · เหลือตามเส้นทางประมาณ ${number.format(Math.max(1, progress.remaining))} ม.`
              : ` · ${progressMessages[progress.status]}`)}
        </p>
      )}
    </div>
  );
}
