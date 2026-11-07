'use client';
import Skeleton from '@mui/material/Skeleton';
import styles from './dashboard.module.css';

export function DashboardSkeleton() {
  return (
    <div className={styles.root} aria-hidden="true" data-dashboard-skeleton>
      <Skeleton width={130} height={24} animation="wave" />
      <Skeleton
        className={styles.headingSkeleton}
        width="min(100%, 430px)"
        height={44}
        animation="wave"
      />
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <Skeleton width={140} height={20} animation="wave" />
          <Skeleton width="80%" height={104} animation="wave" />
          <Skeleton width="80%" height={52} animation="wave" />
          <Skeleton
            className={styles.buttonSkeleton}
            variant="rounded"
            width={195}
            height={48}
            animation="wave"
          />
        </div>
        <div className={styles.heroArt}>
          <Skeleton
            variant="rounded"
            width="70%"
            height={260}
            animation="wave"
          />
        </div>
      </div>
      <div className={styles.below}>
        <div className={styles.mapCard}>
          <div className={styles.preview}>
            <Skeleton
              variant="rectangular"
              width="100%"
              height="100%"
              animation="wave"
            />
          </div>
          <div className={styles.mapInfo}>
            <div>
              <Skeleton width={220} height={28} animation="wave" />
              <Skeleton width={255} height={22} animation="wave" />
            </div>
          </div>
        </div>
        <div className={styles.guide}>
          <Skeleton width={110} height={18} animation="wave" />
          <Skeleton width={170} height={34} animation="wave" />
          <div className={styles.shortcutList}>
            {[0, 1].map((key) => (
              <div className={styles.shortcut} key={key}>
                <Skeleton
                  variant="rounded"
                  width={38}
                  height={38}
                  animation="wave"
                />
                <div>
                  <Skeleton width="80%" height={24} animation="wave" />
                  <Skeleton width="95%" height={18} animation="wave" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton width="80%" height={18} animation="wave" />
        </div>
      </div>
    </div>
  );
}
