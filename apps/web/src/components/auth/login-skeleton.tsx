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
      <div className={styles.signInForm}>
        <div className={styles.skeletonSubmit}>
          <Piece height="3.5rem" control="kmutt" />
        </div>
      </div>
    </div>
  );
}
