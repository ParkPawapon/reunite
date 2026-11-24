import Skeleton from '@mui/material/Skeleton';
import styles from './report-detail.module.css';

export function ReportDetailSkeleton({ motion }: { motion: boolean }) {
  const animation = motion ? 'wave' : false;
  return (
    <div
      className={styles.overviewCard}
      role="status"
      aria-label="กำลังโหลดรายละเอียด"
    >
      <div className={styles.skeletonText} aria-hidden="true">
        <Skeleton width="100%" height={24} animation={animation} />
        <Skeleton width="65%" height={24} animation={animation} />
      </div>
      <div className={styles.details} aria-hidden="true">
        <div className={styles.location}>
          <Skeleton
            variant="rounded"
            width={36}
            height={36}
            animation={animation}
          />
          <div className={styles.locationCopy} style={{ width: '80%' }}>
            <Skeleton width={75} height={16} animation={animation} />
            <Skeleton width="70%" height={24} animation={animation} />
          </div>
        </div>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`${styles.metaTile} ${index === 0 ? styles.category : ''}`}
          >
            <Skeleton width={60} height={16} animation={animation} />
            <Skeleton
              width={index === 0 ? '90%' : '85%'}
              height={22}
              animation={animation}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
