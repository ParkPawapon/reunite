import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { services } from '@/lib/composition';
import { requirePageUser } from '@/modules/auth/presentation/require-page-user';
import type { UserProfile } from '@/modules/users/domain/user';
import { CampusLoading } from '../research/kmutt-bangmod/campus-loading';
import { CampusViewer } from '../research/kmutt-bangmod/campus-viewer';

export const metadata: Metadata = {
  title: 'แผนที่บางมด · Reunite',
  description: 'ค้นหาอาคารและวางเส้นทางเดินใน มจธ. วิทยาเขตบางมด',
  robots: { index: false, follow: false },
};

async function CampusMap({ user }: { user: UserProfile }) {
  const profile = await services().profile.get(user.userId);
  return (
    <AppShell
      page="campus"
      user={{
        name: user.name,
        email: user.email,
        avatarVersion: profile.avatarVersion,
      }}
    >
      <CampusViewer />
    </AppShell>
  );
}

export default async function CampusMapPage() {
  // Redirect before streaming so shared map URL fragments survive login.
  const user = await requirePageUser('/map');
  return (
    <Suspense
      fallback={
        <main>
          <CampusLoading />
        </main>
      }
    >
      <CampusMap user={user} />
    </Suspense>
  );
}
