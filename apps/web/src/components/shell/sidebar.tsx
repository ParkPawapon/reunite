import Image from 'next/image';
import Link from 'next/link';
import { ShellIcon } from './shell-icon';
import styles from './shell.module.css';

export function Sidebar({
  compact = false,
  onNavigate,
  onClose,
  page = 'dashboard',
}: {
  compact?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
  page?: 'dashboard' | 'profile';
}) {
  return (
    <div className={styles.sidebarContent} data-compact={compact}>
      <div className={styles.sidebarBrand}>
        <Link
          href="/dashboard"
          prefetch={false}
          className={styles.brand}
          aria-label="Reunite ภาพรวม"
          onClick={onNavigate}
        >
          <span className={styles.brandFull}>
            reunite<span>.</span>
          </span>
          <span className={styles.brandShort}>
            r<span>.</span>
          </span>
          <small>LOST &amp; FOUND · KMUTT</small>
        </Link>
        {onClose && (
          <button
            className={styles.iconButton}
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู"
          >
            <ShellIcon name="close" />
          </button>
        )}
      </div>
      <p className={styles.navCaption}>
        <span />
        พื้นที่ของคุณ
      </p>
      <nav aria-label="เมนูหลัก" className={styles.navigation}>
        <Link
          href="/dashboard"
          prefetch={false}
          aria-current={page === 'dashboard' ? 'page' : undefined}
          aria-label="ภาพรวม"
          title="ภาพรวม"
          onClick={onNavigate}
        >
          <ShellIcon name="home" />
          <span>ภาพรวม</span>
          <ShellIcon
            name="arrow"
            className={styles.navArrow}
            width={16}
            height={16}
          />
        </Link>
        <Link
          href="/profile"
          prefetch={false}
          aria-current={page === 'profile' ? 'page' : undefined}
          aria-label="โปรไฟล์ของฉัน"
          title="โปรไฟล์ของฉัน"
          onClick={onNavigate}
        >
          <ShellIcon name="user" />
          <span>โปรไฟล์ของฉัน</span>
        </Link>
        <a
          href="/research/kmutt-bangmod"
          aria-label="แผนที่บางมด"
          title="แผนที่บางมด"
          onClick={onNavigate}
        >
          <ShellIcon name="map" />
          <span>แผนที่บางมด</span>
        </a>
      </nav>
      <div className={styles.sidebarNote}>
        <span className={styles.noteDot}>เพื่อนช่วยหา</span>
        <strong>
          อยู่ใกล้กัน
          <br />
          ช่วยกันหา
        </strong>
        <Image
          src="/illustrations/agent-honk.svg"
          width={108}
          height={134}
          alt=""
          className={styles.sidebarGoose}
        />
        <p>พื้นที่เล็ก ๆ ของคนบางมด</p>
      </div>
    </div>
  );
}
