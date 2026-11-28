'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { accountRequest } from '@/modules/users/presentation/profile-client';
import styles from './report-contact.module.css';

const statusSchema = z.object({
  open: z.boolean(),
  enabled: z.boolean(),
  pendingCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  checkedCount: z.number().int().nonnegative(),
  latestMatchId: z.number().int().positive().nullable(),
});

export function ReportMatchingStatus({ reportId }: { reportId: number }) {
  const [status, setStatus] = useState<z.infer<typeof statusSchema> | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const result = await accountRequest(
          `/api/v1/item-reports/${reportId}/matching`,
          statusSchema,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(10000),
            ]),
          },
        );
        if (!controller.signal.aborted) {
          setStatus(result);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reportId]);

  let message = 'กำลังโหลดสถานะ…';
  if (failed) message = 'โหลดสถานะไม่ได้ ระบบจะลองอีกครั้ง';
  else if (status) {
    if (!status.open) message = 'หยุดตรวจคู่สำหรับประกาศที่ปิดแล้ว';
    else if (status.latestMatchId) message = 'มีรายการที่อาจตรงกัน';
    else if (!status.enabled) message = 'ระบบจับคู่ยังไม่เปิดให้บริการ';
    else if (status.pendingCount) message = 'กำลังรอคิวหรือตรวจคู่';
    else if (status.failedCount) message = 'บางรายการตรวจไม่สำเร็จ';
    else if (status.checkedCount) message = 'ยังไม่พบคู่จากรายการที่ตรวจแล้ว';
    else message = 'ยังไม่มีคู่ที่ตรวจแล้ว';
  }
  return (
    <section className={styles.contact} aria-label="สถานะจับคู่">
      <h3>สถานะจับคู่</h3>
      <p role="status">{message}</p>
      {!failed && status?.latestMatchId && (
        <Link href={`/matches/${status.latestMatchId}`}>เปิดดูคู่ที่แนะนำ</Link>
      )}
    </section>
  );
}
