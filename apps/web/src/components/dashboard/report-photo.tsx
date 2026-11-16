'use client';
import Image from 'next/image';
import Skeleton from '@mui/material/Skeleton';
import { useState } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import styles from './report-detail.module.css';

export function ReportPhoto({
  href,
  title,
  motion,
}: {
  href: string;
  title: string;
  motion: boolean;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <figure className={styles.photo}>
      <div className={styles.photoFrame} aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <div
            className={styles.photoSkeleton}
            role="status"
            aria-label="กำลังโหลดรูปสิ่งของ"
          >
            <Skeleton
              variant="rectangular"
              width="100%"
              height="100%"
              animation={motion ? 'wave' : false}
            />
          </div>
        )}
        {state === 'error' ? (
          <div className={styles.photoFailure} role="status">
            <ShellIcon name="camera" />
            <p>เปิดรูปไม่สำเร็จ</p>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setState('loading')}
            >
              ลองโหลดรูปอีกครั้ง
            </button>
          </div>
        ) : (
          <Image
            src={href}
            alt={`รูป ${title}`}
            width={1024}
            height={1024}
            unoptimized
            className={styles.photoImage}
            data-loaded={state === 'ready'}
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
          />
        )}
      </div>
      <figcaption>
        <a
          href={href}
          className={styles.imageLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          ดูรูปเต็ม <ShellIcon name="external" width={14} height={14} />
          <span className={styles.srOnly}>ในแท็บใหม่</span>
        </a>
      </figcaption>
    </figure>
  );
}
