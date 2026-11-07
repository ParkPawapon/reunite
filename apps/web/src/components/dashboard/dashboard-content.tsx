'use client';
import { CampusPreview } from './campus-preview';
import { DashboardWelcome } from './dashboard-welcome';
import { DashboardShortcuts } from './dashboard-shortcuts';
import styles from './dashboard.module.css';
export function DashboardContent({ name }: { name: string }) {
  return (
    <div className={styles.root} data-dashboard>
      <p className={styles.greeting}>
        สวัสดี, <span>{name}</span>
      </p>
      <h1 className={styles.heading}>เริ่มต้นจากที่ที่คุ้นเคย</h1>
      <DashboardWelcome />
      <div className={styles.below}>
        <CampusPreview />
        <DashboardShortcuts />
      </div>
    </div>
  );
}
