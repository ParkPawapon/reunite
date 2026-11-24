'use client';
import Image from 'next/image';
import Skeleton from '@mui/material/Skeleton';
import { useState } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import styles from './report-detail.module.css';

export function ReportPhoto({
  hrefs,
  title,
  motion,
}: {
  hrefs: string[];
  title: string;
  motion: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [states, setStates] = useState<
    Record<string, 'loading' | 'ready' | 'error'>
  >({});
  const safeIndex = Math.min(selectedIndex, Math.max(0, hrefs.length - 1));
  const activeHref = hrefs[safeIndex];
  if (!activeHref) return null;
  const state = states[activeHref] ?? 'loading';
  const alt =
    hrefs.length > 1
      ? `รูป ${title} (รูปที่ ${safeIndex + 1} จาก ${hrefs.length})`
      : `รูป ${title}`;

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
              className={styles.outlineBtn}
              onClick={() =>
                setStates((current) => ({
                  ...current,
                  [activeHref]: 'loading',
                }))
              }
            >
              ลองโหลดรูปอีกครั้ง
            </button>
          </div>
        ) : (
          <Image
            key={activeHref}
            src={activeHref}
            alt={alt}
            width={1024}
            height={1024}
            unoptimized
            className={styles.photoImage}
            data-loaded={state === 'ready'}
            onLoad={() =>
              setStates((current) => ({ ...current, [activeHref]: 'ready' }))
            }
            onError={() =>
              setStates((current) => ({ ...current, [activeHref]: 'error' }))
            }
          />
        )}
      </div>
      <figcaption className={styles.photoToolbar}>
        {hrefs.length > 1 ? (
          <div
            className={styles.galleryStrip}
            role="group"
            aria-label="เลือกรูปสิ่งของ"
          >
            {hrefs.map((href, index) => (
              <button
                key={href}
                type="button"
                className={styles.galleryThumb}
                aria-pressed={index === safeIndex}
                aria-label={`ดูรูปที่ ${index + 1}`}
                onClick={() => setSelectedIndex(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- bounded authenticated report thumbnail */}
                <img src={href} alt="" />
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className={styles.photoCaption}>ภาพประกอบหลัก</span>
        )}
        <div className={styles.photoMetaActions}>
          {hrefs.length > 1 && (
            <span className={styles.photoCounter}>
              รูปที่ {safeIndex + 1}/{hrefs.length}
            </span>
          )}
          <a
            href={activeHref}
            className={styles.imageLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            ดูรูปเต็ม <ShellIcon name="external" width={14} height={14} />
            <span className={styles.srOnly}>ในแท็บใหม่</span>
          </a>
        </div>
      </figcaption>
    </figure>
  );
}
