import Image from 'next/image';
import { ShellIcon } from '@/components/shell/shell-icon';
import styles from './match-reveal.module.css';

export function MatchReveal({
  returned,
  motion,
}: {
  returned: boolean;
  motion: boolean;
}) {
  return (
    <div
      className={styles.scene}
      aria-hidden="true"
      data-match-scene={returned ? 'returned' : 'suggested'}
      data-motion={motion ? 'on' : 'off'}
    >
      <div className={styles.signal} data-match-effect="signal" />
      <div className={styles.scope}>
        <div className={styles.sweep} />
      </div>
      <div className={styles.lost} data-match-effect="lost">
        <ShellIcon name="box" />
      </div>
      <div className={styles.found} data-match-effect="found">
        <ShellIcon name="pin" />
      </div>
      <Image
        className={styles.honk}
        src="/illustrations/agent-honk.svg"
        width={120}
        height={150}
        alt=""
        loading="eager"
      />
      <div className={styles.seal} data-match-effect="seal">
        <ShellIcon name={returned ? 'check' : 'target'} />
      </div>
    </div>
  );
}
