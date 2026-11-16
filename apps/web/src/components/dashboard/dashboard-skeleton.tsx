'use client';
import Skeleton from '@mui/material/Skeleton';
import { ReportTable } from './report-table';
import styles from './report-board.module.css';
export function DashboardSkeleton() {
  return (
    <div className={styles.root} aria-hidden="true" data-dashboard-skeleton>
      <div className={styles.pageHeader}>
        <div>
          <Skeleton width={140} height={24} animation={false} />
          <Skeleton width="min(100%, 360px)" height={48} animation={false} />
          <Skeleton width="min(100%, 280px)" height={25} animation={false} />
        </div>
      </div>
      <div className={styles.board}>
        <div className={styles.tabsBar}>
          <Skeleton width={250} height={64} animation={false} />
        </div>
        <div className={styles.context}>
          <Skeleton width={130} height={20} animation={false} />
        </div>
        <ReportTable rows={[]} type="LOST" loading />
      </div>
    </div>
  );
}
