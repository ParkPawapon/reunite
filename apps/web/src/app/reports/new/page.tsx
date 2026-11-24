import type { Metadata } from 'next';
import { requirePageUser } from '@/modules/auth/presentation/require-page-user';
import { AppShell } from '@/components/shell/app-shell';
import { ReportSubmission } from '@/components/item-reports/report-submission';
import { services } from '@/lib/composition';

export const metadata: Metadata = {
  title: 'แจ้งสิ่งของ · Reunite',
  description: 'แจ้งของหายหรือของที่พบ ช่วยกันหา พากลับคืน',
};
export default async function NewReportPage() {
  const user = await requirePageUser('/reports/new');
  const profile = await services().profile.get(user.userId);
  return (
    <AppShell
      page="report-new"
      user={{
        name: user.name,
        email: user.email,
        avatarVersion: profile.avatarVersion,
      }}
    >
      <ReportSubmission />
    </AppShell>
  );
}
