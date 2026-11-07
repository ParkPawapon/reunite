import Skeleton from '@mui/material/Skeleton';
import { AppShell } from '@/components/shell/app-shell';
import styles from './profile.module.css';

export function ProfileSkeleton() {
  return (
    <AppShell page="profile" loading>
      <div className={styles.root} aria-hidden="true" data-profile-skeleton>
        <div className={styles.skeletonTitle}>
          <Skeleton width={100} height={24} animation="wave" />
          <Skeleton width={240} height={42} animation="wave" />
          <Skeleton width={285} height={24} animation="wave" />
        </div>
        <div className={styles.identity}>
          <div className={`${styles.identityPerson} ${styles.skeletonPerson}`}>
            <div className={styles.portrait}>
              <Skeleton
                variant="circular"
                width={76}
                height={76}
                animation="wave"
              />
            </div>
            <div className={styles.skeletonPerson}>
              <Skeleton width="65%" height={28} animation="wave" />
              <Skeleton width="80%" height={20} animation="wave" />
            </div>
          </div>
          <div className={styles.photoControls}>
            <Skeleton
              className={styles.skeletonButton}
              variant="rounded"
              height={44}
              animation="wave"
            />
            <Skeleton width="90%" height={20} animation="wave" />
          </div>
        </div>
        <div className={styles.form}>
          {[2, 4, 2].map((count, section) => (
            <div className={styles.section} key={section}>
              <div className={styles.sectionHeading}>
                <Skeleton width={115} height={25} animation="wave" />
              </div>
              <div className={styles.skeletonFields}>
                {Array.from({ length: count }, (_, field) => (
                  <div
                    key={field}
                    className={styles.skeletonField}
                    data-profile-skeleton-field
                  >
                    <Skeleton
                      className={styles.skeletonLabel}
                      width={80}
                      height={14}
                      animation="wave"
                    />
                    <Skeleton
                      variant="rounded"
                      width="100%"
                      height={42}
                      animation="wave"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className={styles.actions}>
            <Skeleton width={135} height={22} animation="wave" />
            <Skeleton
              className={styles.skeletonButton}
              variant="rounded"
              height={44}
              animation="wave"
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
