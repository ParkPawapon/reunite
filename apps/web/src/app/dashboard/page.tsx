import type { Metadata } from 'next';
import { requirePageUser } from '@/modules/auth/presentation/require-page-user';
import { AppShell } from '@/components/shell/app-shell';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { services } from '@/lib/composition';

export const metadata: Metadata = {
  title: 'ภาพรวม · Reunite',
  description: 'พื้นที่เริ่มต้นของเพื่อนช่วยหาที่บางมด',
};
export default async function DashboardPage() {
  const user = await requirePageUser();
  const profile = await services().profile.get(user.userId);
  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        avatarVersion: profile.avatarVersion,
      }}
    >
      <DashboardContent name={user.name} />
    </AppShell>
  );
}
