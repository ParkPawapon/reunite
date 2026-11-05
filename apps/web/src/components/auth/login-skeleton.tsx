'use client';

import Skeleton from '@mui/material/Skeleton';
import styles from './login.module.css';

function Piece({
  width = '100%',
  height,
  control,
}: {
  width?: string;
  height: string;
  control?: string;
}) {
  return (
    <Skeleton
      className={styles.skeletonPiece}
      variant="rounded"
      width={width}
      height={height}
      animation="wave"
      data-skeleton-for={control}
    />
  );
}

export function LoginSkeleton() {
  return (
    <div
      className={`${styles.formContent} ${styles.skeletonContent}`}
      data-login-skeleton
      aria-hidden="true"
    >
      <div className={styles.welcomeMark}>
        <Piece width="1.5rem" height="1.5rem" />
      </div>
      <div className={styles.formEyebrow}>
        <Piece width="7rem" height=".8125rem" />
      </div>
      <div className={styles.skeletonHeading}>
        <Piece width="12rem" height="2rem" />
      </div>
      <div className={styles.formIntro}>
        <Piece width="15rem" height=".875rem" />
      </div>
      <div className={styles.form}>
        <div className={styles.field}>
          <div className={styles.skeletonLabel}>
            <Piece width="2.75rem" height=".8125rem" />
          </div>
          <Piece height="3.5rem" control="email" />
        </div>
        <div className={styles.field}>
          <div className={styles.skeletonLabel}>
            <Piece width="4rem" height=".8125rem" />
          </div>
          <Piece height="3.5rem" control="password" />
        </div>
        <div className={styles.skeletonSubmit}>
          <Piece height="3.5rem" control="submit" />
        </div>
      </div>
      <div className={styles.mapLink}>
        <span className={styles.skeletonMapLine}>
          <Piece width="8rem" height=".8125rem" />
        </span>
      </div>
    </div>
  );
}
