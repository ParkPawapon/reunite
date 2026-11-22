'use client';
import Skeleton from '@mui/material/Skeleton';
import { useShellMotion } from '@/components/shell/shell-motion';
import { ShellIcon } from '@/components/shell/shell-icon';
import type {
  ReportRow,
  ReportType,
} from '@/modules/item-reports/presentation/reports-client';
import styles from './report-board.module.css';

export const reportDate = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});
export const reportStatusLabels = {
  OPEN: 'เปิดอยู่',
  RESOLVED: 'ได้คืนแล้ว',
  CLOSED: 'ปิดแล้ว',
};
export function ReportStatus({ status }: { status: ReportRow['status'] }) {
  return (
    <span className={styles.status} data-status={status}>
      <i aria-hidden="true" />
      {reportStatusLabels[status]}
    </span>
  );
}
export function ReportTable({
  rows,
  type,
  loading = false,
  searched = false,
  onOpen,
}: {
  rows: ReportRow[];
  type: ReportType;
  loading?: boolean;
  searched?: boolean;
  onOpen?: (id: number) => void;
}) {
  const motion = useShellMotion();
  return (
    <>
      <div
        className={styles.tableScroll}
        role="region"
        aria-label="ตารางรายการสิ่งของ เลื่อนแนวนอนได้"
        tabIndex={loading ? -1 : 0}
      >
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            {`${type === 'LOST' ? 'รายการของหาย' : 'รายการของที่พบ'} เรียงตามวันที่แจ้งล่าสุด`}
          </caption>
          <thead>
            <tr>
              <th scope="col">สิ่งของ</th>
              <th scope="col">หมวดหมู่</th>
              <th scope="col">
                {type === 'LOST' ? 'สถานที่หาย' : 'สถานที่พบ'}
              </th>
              <th scope="col">{type === 'LOST' ? 'วันที่หาย' : 'วันที่พบ'}</th>
              <th scope="col">สถานะ</th>
              <th scope="col">
                <span className={styles.srOnly}>รายละเอียด</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} aria-hidden="true" data-report-skeleton>
                    {[0, 1, 2, 3, 4, 5].map((cell) => (
                      <td key={cell}>
                        <Skeleton
                          width={cell === 0 ? '80%' : '70%'}
                          height={22}
                          animation={motion ? 'wave' : false}
                        />
                        {cell === 0 && (
                          <Skeleton
                            width="55%"
                            height={17}
                            animation={motion ? 'wave' : false}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              : rows.length
                ? rows.map((row) => (
                    <tr key={row.reportId} data-report-id={row.reportId}>
                      <td>
                        <button
                          type="button"
                          className={styles.itemTitle}
                          onClick={() => onOpen?.(row.reportId)}
                        >
                          {row.title}
                        </button>
                        {row.description && (
                          <p className={styles.itemDescription}>
                            {row.description}
                          </p>
                        )}
                      </td>
                      <td>{row.categoryName}</td>
                      <td>{row.locationName}</td>
                      <td className={styles.date}>
                        <time dateTime={row.eventDatetime}>
                          {reportDate.format(new Date(row.eventDatetime))}
                        </time>
                      </td>
                      <td>
                        <ReportStatus status={row.status} />
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.openButton}
                          onClick={() => onOpen?.(row.reportId)}
                          aria-label={`ดูรายละเอียด ${row.title}`}
                        >
                          <ShellIcon name="arrow" width={18} height={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 && (
        <div className={styles.emptyCell}>
          <span className={styles.emptyMark} aria-hidden="true">
            <ShellIcon name="box" width={25} height={25} />
          </span>
          <h2>
            {searched
              ? 'ไม่พบสิ่งของที่ค้นหา'
              : type === 'LOST'
                ? 'ยังไม่มีรายการของหาย'
                : 'ยังไม่มีรายการของที่พบ'}
          </h2>
          <p>
            {searched
              ? 'ลองใช้คำค้นสั้นลง หรือสลับประเภทสิ่งของ'
              : 'เมื่อมีการแจ้ง รายการจะแสดงที่นี่'}
          </p>
        </div>
      )}
    </>
  );
}
