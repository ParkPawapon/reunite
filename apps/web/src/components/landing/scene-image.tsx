'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import styles from './landing.module.css';

type SceneImageProps = Omit<ImageProps, 'onLoad' | 'onError'> & {
  depth?: number;
};

export function SceneImage({
  alt,
  depth,
  className,
  ...image
}: SceneImageProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  );

  return (
    <div className={className} data-parallax={depth} data-scene-image={state}>
      <Image
        {...image}
        alt={alt}
        onLoad={() => setState('ready')}
        onError={() => setState('unavailable')}
      />
      <span className={styles.loadingEdge} aria-hidden="true" />
    </div>
  );
}
