import Skeleton from '@mui/material/Skeleton';
import styles from './report-detail.module.css';

export function ReportDetailSkeleton({ motion }: { motion: boolean }) {
  const animation = motion ? 'wave' : false;
  return (
    <div role="status" aria-label="กำลังโหลดรายละเอียด">
      <div className={styles.skeletonText} aria-hidden="true">
        <Skeleton width="100%" height={24} animation={animation} />
        <Skeleton width="65%" height={24} animation={animation} />
      </div>
      <div className={styles.details} aria-hidden="true">
        <div className={styles.location}>
          <Skeleton
            variant="rounded"
            width={20}
            height={20}
            animation={animation}
          />
          <div style={{ width: '80%' }}>
            <Skeleton width={75} height={18} animation={animation} />
            <Skeleton height={25} animation={animation} />
          </div>
        </div>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={index === 0 ? styles.category : undefined}
          >
            <Skeleton width={60} height={18} animation={animation} />
            <Skeleton
              width={index === 0 ? '90%' : '85%'}
              height={24}
              animation={animation}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
