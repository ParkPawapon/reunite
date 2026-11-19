import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import { walkProgress } from './live-position';
import type { useLivePosition } from './use-live-position';
import type { WalkRoute } from './walking';
import styles from './viewer.module.css';

const messages = {
  off: 'ตำแหน่งสดใช้เฉพาะบนอุปกรณ์และเริ่มเมื่อคุณอนุญาต',
  requesting: 'กำลังขอสิทธิ์เข้าถึงตำแหน่ง…',
  searching: 'กำลังรอสัญญาณตำแหน่งจากอุปกรณ์…',
  live: 'กำลังแสดงตำแหน่งสด',
  denied:
    'ยังไม่ได้รับสิทธิ์ตำแหน่ง เปิดสิทธิ์ของเว็บไซต์ในเบราว์เซอร์แล้วลองอีกครั้ง',
  unavailable: 'ยังรับตำแหน่งไม่ได้ กำลังรอสัญญาณใหม่',
  unsupported: 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง',
  insecure: 'ตำแหน่งสดต้องเปิดเว็บผ่าน HTTPS หรือ localhost',
  imprecise: 'สัญญาณ GPS ไม่แม่นยำ (เกิน 25 ม.)',
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
          {gps.tracking ? 'จบการเดิน' : 'ลองรับตำแหน่งอีกครั้ง'}
        </button>
        {!gps.tracking && (
          <button type="button" onClick={gps.stop}>
            เลือกต้นทางใหม่
          </button>
        )}
        <Tooltip title="ตามตำแหน่งฉัน">
          <span>
            <IconButton
              className={styles.iconControl}
              aria-label="ตามตำแหน่งฉัน"
              aria-pressed={following}
              disabled={!fix}
              onClick={onFollow}
            >
              <ShellIcon name="target" />
            </IconButton>
          </span>
        </Tooltip>
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
