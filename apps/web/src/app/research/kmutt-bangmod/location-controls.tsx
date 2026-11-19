import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import type { WalkProgress } from './live-position';
import type { useLivePosition } from './use-live-position';
import { walkingMinutes } from './walking';
import styles from './viewer.module.css';

const messages = {
  off: 'กำลังรอตำแหน่งล่าสุด',
  requesting: 'กำลังขอสิทธิ์เข้าถึงตำแหน่ง…',
  searching: 'กำลังรอตำแหน่งล่าสุด…',
  live: '',
  denied:
    'ยังไม่ได้รับสิทธิ์ตำแหน่ง เปิดสิทธิ์ของเว็บไซต์ในเบราว์เซอร์แล้วลองอีกครั้ง',
  unavailable: 'ยังรับตำแหน่งไม่ได้ กำลังรอสัญญาณใหม่',
  unsupported: 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง',
  insecure: 'ตำแหน่งสดต้องเปิดเว็บผ่าน HTTPS หรือ localhost',
  imprecise: 'สัญญาณ GPS ไม่แม่นยำ (เกิน 25 ม.)',
  stale: 'ตำแหน่งหมดอายุ กำลังรอตำแหน่งล่าสุด',
  outside: 'ตำแหน่งอยู่นอกขอบเขตแผนที่วิทยาเขต',
};
const progressMessages = {
  imprecise: 'สัญญาณ GPS ไม่แม่นยำ',
  away: 'ตำแหน่งอยู่นอกแนวเส้นทาง',
  ambiguous: 'ไม่สามารถระบุตำแหน่งบนเส้นทางได้',
};
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

export function LocationControls({
  gps,
  progress,
  destination,
  arrived,
  following,
  onFollow,
  onRetry,
  onEnd,
}: {
  gps: ReturnType<typeof useLivePosition>;
  progress: WalkProgress | null;
  destination: string;
  arrived: boolean;
  following: boolean;
  onFollow: () => void;
  onRetry: () => void;
  onEnd: () => void;
}) {
  const { status } = gps.state;
  const matched = progress && 'remaining' in progress ? progress : null;
  const explanation =
    progress && !('remaining' in progress)
      ? progressMessages[progress.status]
      : '';
  const changeOrigin =
    !arrived &&
    ['denied', 'unavailable', 'unsupported', 'insecure', 'off'].includes(
      status,
    );
  const retry =
    !arrived &&
    (status === 'denied' || status === 'unavailable' || status === 'off');

  return (
    <div className={styles.locationPanel}>
      <h2 className={styles.destination}>
        <ShellIcon name="pin" /> {destination}
      </h2>
      <p role="status" className={arrived ? styles.arrival : undefined}>
        {arrived ? (
          <>
            <ShellIcon name="check" /> {'ถึงบริเวณ ' + destination + ' แล้ว'}
          </>
        ) : (
          messages[status]
        )}
      </p>
      {!arrived && (
        <>
          <p>ระยะทางที่เหลือ</p>
          <p className={styles.remaining}>
            <strong>
              {matched
                ? number.format(Math.ceil(matched.remaining)) + ' ม.'
                : '—'}
            </strong>
            <span>
              {matched
                ? 'ประมาณ ' +
                  number.format(Math.ceil(walkingMinutes(matched.remaining))) +
                  ' นาที'
                : '—'}
            </span>
          </p>
          {explanation && <p>{explanation}</p>}
        </>
      )}
      <div className={styles.controls}>
        {!arrived && (
          <Tooltip title="ตามตำแหน่งฉัน">
            <span>
              <IconButton
                className={styles.iconControl}
                aria-label="ตามตำแหน่งฉัน"
                aria-pressed={following}
                disabled={status !== 'live'}
                onClick={onFollow}
              >
                <ShellIcon name="target" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {retry && (
          <Tooltip title="ลองรับตำแหน่งอีกครั้ง">
            <IconButton
              className={styles.iconControl}
              aria-label="ลองรับตำแหน่งอีกครั้ง"
              onClick={onRetry}
            >
              <ShellIcon name="refresh" />
            </IconButton>
          </Tooltip>
        )}
        {changeOrigin && (
          <button type="button" onClick={onEnd}>
            เลือกต้นทางใหม่
          </button>
        )}
        <button type="button" onClick={onEnd}>
          <ShellIcon name="close" /> จบการเดิน
        </button>
      </div>
    </div>
  );
}
