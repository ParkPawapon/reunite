import Skeleton from '@mui/material/Skeleton';
import { AppShell } from '@/components/shell/app-shell';
import styles from './report-submission.module.css';

export function ReportSubmissionSkeleton() {
  return (
    <AppShell page="report-new" loading>
      <div className={styles.root} aria-hidden="true">
        <Skeleton width="min(100%, 160px)" height={46} animation="wave" />
        <Skeleton width="min(100%, 280px)" height={24} animation="wave" />
      </div>
    </AppShell>
  );
}
