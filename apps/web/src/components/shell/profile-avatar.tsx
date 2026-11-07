'use client';
import Image from 'next/image';
import { useState } from 'react';
import Skeleton from '@mui/material/Skeleton';
import { useShellMotion } from './shell-motion';
import styles from './shell.module.css';

export function ProfileAvatar({
  name,
  version,
  size = 32,
}: {
  name: string;
  version?: string | null;
  size?: number;
}) {
  const [failedVersion, setFailedVersion] = useState<string | null>(null);
  const [readyVersion, setReadyVersion] = useState<string | null>(null);
  const running = useShellMotion();
  const hasImage = Boolean(version && version !== failedVersion);
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, Math.round(size * 0.32)),
      }}
      data-ready={!hasImage || readyVersion === version}
      aria-hidden="true"
    >
      {version && version !== failedVersion ? (
        <Image
          src={`/api/v1/profile/avatar?v=${version}`}
          alt=""
          width={size}
          height={size}
          unoptimized
          onLoad={() => setReadyVersion(version ?? null)}
          onError={() => setFailedVersion(version)}
        />
      ) : (
        Array.from(name.trim())[0] || '?'
      )}
      {hasImage && readyVersion !== version && (
        <Skeleton
          className={styles.avatarSkeleton}
          variant="circular"
          width="100%"
          height="100%"
          animation={running ? 'wave' : false}
        />
      )}
    </span>
  );
}
