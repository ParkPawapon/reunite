import Link from 'next/link';
import { ShellIcon } from '@/components/shell/shell-icon';
import styles from './dashboard.module.css';
export function DashboardShortcuts() {
  return (
    <section className={styles.guide} aria-labelledby="guide-title">
      <p className={styles.guideEyebrow}>พื้นที่เล็ก ๆ ของคุณ</p>
      <h2 id="guide-title">พร้อมไปต่อด้วยกัน</h2>
      <div className={styles.shortcutList}>
        <Link prefetch={false} href="/profile" className={styles.shortcut}>
          <span className={styles.shortcutIcon}>
            <ShellIcon name="user" />
          </span>
          <div>
            <h3>โปรไฟล์ของฉัน</h3>
            <p>ดูแลข้อมูลติดต่อและรูปโปรไฟล์</p>
          </div>
          <ShellIcon name="arrow" width={16} />
        </Link>
        <a
          className={styles.shortcut}
          href="https://www.kmutt.ac.th/virtual/bangmod/"
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.shortcutIcon}>
            <ShellIcon name="map" />
          </span>
          <div>
            <h3>เดินชมบางมด</h3>
            <p>Virtual Tour จากมหาวิทยาลัย</p>
          </div>
          <ShellIcon name="external" width={16} />
          <span className={styles.srOnly}>เปิดแท็บใหม่</span>
        </a>
      </div>
      <p className={styles.guideFoot}>
        <span />
        ค่อย ๆ ตามหา ในที่ที่คุ้นเคย
      </p>
    </section>
  );
}
