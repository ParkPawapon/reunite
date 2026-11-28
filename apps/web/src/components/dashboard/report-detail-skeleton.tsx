import Skeleton from '@mui/material/Skeleton';
import styles from './report-detail.module.css';

export function ReportDetailSkeleton({ motion }: { motion: boolean }) {
  const animation = motion ? 'wave' : false;
  return (
    <div
      className={styles.overviewDetails}
      role="status"
      aria-label="กำลังโหลดรายละเอียด"
    >
      <div className={styles.skeletonText} aria-hidden="true">
        <Skeleton width="100%" height={22} animation={animation} />
        <Skeleton width="68%" height={22} animation={animation} />
      </div>
      <div className={styles.metaList} aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={styles.metaRow}>
            <Skeleton
              variant="rounded"
              width={34}
              height={34}
              className={styles.metaIcon}
              animation={animation}
            />
            <Skeleton width={70} height={15} animation={animation} />
            <Skeleton
              width={index === 0 ? '75%' : index === 1 ? '65%' : '55%'}
              height={20}
              animation={animation}
            />
          </div>
        ))}
      </div>
      <div className={styles.publisher} aria-hidden="true">
        <h3>
          <Skeleton width={90} height="1em" animation={animation} />
        </h3>
        <div className={styles.publisherDetails}>
          {[0, 1, 2].map((index) => (
            <div key={index}>
              <Skeleton width={60} height={18} animation={animation} />
              <Skeleton width="85%" height={24} animation={animation} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
