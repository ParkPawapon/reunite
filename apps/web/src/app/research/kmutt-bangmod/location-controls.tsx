import type { Ref } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ShellIcon } from '@/components/shell/shell-icon';
import type { WalkProgress } from './live-position';
import { placesById } from './places';
import type { useLivePosition } from './use-live-position';
import { WalkSteps } from './walk-planner';
import { walkingMinutes, type WalkRoute } from './walking';
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
  headingRef,
  progress,
  destination,
  arrived,
  rerouting,
  recovery,
  route,
  onChooseOrigin,
  onFinish,
  onRetry,
  onEnd,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  gps: ReturnType<typeof useLivePosition>;
  progress: WalkProgress | null;
  destination: string;
  arrived: boolean;
  rerouting: boolean;
  recovery: boolean;
  route: WalkRoute;
  onChooseOrigin: () => void;
  onFinish: () => void;
  onRetry: () => void;
  onEnd: () => void;
}) {
  const { status } = gps.state;
  const matched = progress && 'remaining' in progress ? progress : null;
  const awaitingFix = status === 'requesting' || status === 'searching';
  const remaining = matched?.remaining ?? (awaitingFix ? route.metres : null);
  const distance =
    remaining === null
      ? null
      : number.format(
          matched ? Math.ceil(remaining) : Math.round(remaining / 10) * 10,
        );
  const origin = placesById.get(route.from.id);
  const originName =
    route.from.basis === 'live-position'
      ? 'ตำแหน่งของฉัน'
      : (origin?.building?.code ?? origin?.nameTh ?? route.from.id);
  const explanation =
    !rerouting && !recovery && progress && !('remaining' in progress)
      ? progressMessages[progress.status]
      : '';
  const changeOrigin =
    recovery ||
    (!arrived &&
      ['denied', 'unavailable', 'unsupported', 'insecure', 'off'].includes(
        status,
      ));
  const retry =
    !arrived &&
    (status === 'denied' || status === 'unavailable' || status === 'off');

  return (
    <div className={arrived ? styles.arrivalPanel : styles.activeNavigation}>
      {arrived && (
        <span className={styles.arrivalBadge}>
          <ShellIcon name="check" />
        </span>
      )}
      <h2 className={styles.destination} tabIndex={-1} ref={headingRef}>
        {arrived ? (
          <span role="status">ถึงบริเวณ {destination} แล้ว</span>
        ) : (
          'เดินไป ' + destination
        )}
      </h2>
      {arrived ? (
        <p className={styles.walkNote}>ตรวจป้ายอาคารและทางเข้าหน้างาน</p>
      ) : (
        <>
          <p className={styles.walkNote}>ตามเส้นทางสีส้มไปยังจุดหมาย</p>
          <p
            className={styles.remainingEstimate}
            role="group"
            aria-label={
              remaining === null
                ? 'ยังไม่ทราบระยะทางและเวลาที่เหลือ'
                : 'ระยะทางและเวลาที่เหลือ'
            }
          >
            <strong>
              {remaining !== null
                ? number.format(Math.ceil(walkingMinutes(remaining)))
                : '—'}
            </strong>
            <span className={styles.desktopDistance}>
              นาที · {distance === null ? '—' : distance + ' ม.'}
            </span>
            <span className={styles.mobileDistance}>
              นาที · {distance === null ? '—' : 'ประมาณ ' + distance + ' เมตร'}
            </span>
          </p>
          <div className={styles.navigationEndpoints}>
            <p>ต้นทาง {originName}</p>
            <p>ปลายทาง {destination}</p>
          </div>
          <p className={styles.navigationNote}>
            <span>ใช้ตำแหน่ง GPS ระหว่างนำทาง</span>
            <span>ระยะและเวลาเป็นค่าประมาณ</span>
          </p>
          <p className={styles.gpsMessage} role="status">
            {rerouting
              ? 'กำลังหาเส้นทางใหม่…'
              : recovery
                ? 'หาเส้นทางจากตำแหน่งนี้ไม่ได้ เลือกต้นทางใหม่เพื่อลองอีกครั้ง'
                : messages[status]}
          </p>
          {explanation && <p className={styles.walkNote}>{explanation}</p>}
        </>
      )}
      {arrived ? (
        <button
          type="button"
          className={styles.primaryAction}
          onClick={onFinish}
        >
          จบการเดิน
        </button>
      ) : (
        <details className={styles.nextSteps}>
          <summary className={styles.primaryAction}>ดูขั้นตอนถัดไป</summary>
          <WalkSteps route={route} />
        </details>
      )}
      <div
        className={styles.walkActions}
        aria-label="ควบคุมการเดิน"
        role="group"
      >
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
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={onChooseOrigin}
          >
            เลือกต้นทางใหม่
          </button>
        )}
        {!arrived && (
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={onEnd}
          >
            หยุดนำทาง
          </button>
        )}
      </div>
    </div>
  );
}
