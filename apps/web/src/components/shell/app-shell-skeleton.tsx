import { AppShell } from './app-shell';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export function AppShellSkeleton() {
  return (
    <AppShell loading>
      <DashboardSkeleton />
    </AppShell>
  );
}
