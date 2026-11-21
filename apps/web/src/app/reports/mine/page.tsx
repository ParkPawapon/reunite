import type { Metadata } from 'next';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { AppShell } from '@/components/shell/app-shell';
import { services } from '@/lib/composition';
import { requirePageUser } from '@/modules/auth/presentation/require-page-user';

export const metadata: Metadata = {
  title: 'รายการของฉัน · Reunite',
  robots: { index: false, follow: false },
};

export default async function MyReportsPage() {
  const user = await requirePageUser();
  const profile = await services().profile.get(user.userId);
  return (
    <AppShell
      page="myReports"
      user={{
        name: user.name,
        email: user.email,
        avatarVersion: profile.avatarVersion,
      }}
    >
      <DashboardContent owned />
    </AppShell>
  );
}
