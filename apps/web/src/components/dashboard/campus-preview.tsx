'use client';
import { useState } from 'react';
import Image from 'next/image';
import Skeleton from '@mui/material/Skeleton';
import { ShellIcon } from '@/components/shell/shell-icon';
import styles from './dashboard.module.css';

export function CampusPreview() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <a href="/research/kmutt-bangmod" className={styles.mapCard}>
      <div
        className={styles.preview}
        data-campus-preview={state}
        aria-busy={state === 'loading'}
      >
        <Image
          src="/research/kmutt-bangmod/bangmod-campus.webp"
          alt="ภาพเรนเดอร์โมเดลมหาวิทยาลัย มจธ. บางมด สำหรับการศึกษา"
          fill
          sizes="(max-width:999px) 100vw, 60vw"
          className={styles.previewImage}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
        <Skeleton
          className={styles.previewSkeleton}
          variant="rectangular"
          width="100%"
          height="100%"
          animation="wave"
          aria-hidden="true"
        />
        {state === 'error' && (
          <p className={styles.previewError} role="status">
            เปิดภาพตัวอย่างไม่สำเร็จ
            <br />
            ยังเปิดแผนที่ได้ตามปกติ
          </p>
        )}
        <span className={styles.previewTag}>โมเดลเพื่อการศึกษา</span>
      </div>
      <div className={styles.mapInfo}>
        <div>
          <h2>บางมด ในมุมที่คุ้นเคย</h2>
          <p>สำรวจอาคารและวางเส้นทางเดินในมหาวิทยาลัย</p>
        </div>
        <span className={styles.circleArrow}>
          <ShellIcon name="arrow" />
        </span>
      </div>
    </a>
  );
}
