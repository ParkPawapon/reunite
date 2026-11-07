import type { Metadata } from 'next';
import { requirePageUser } from '@/modules/auth/presentation/require-page-user';
import { services } from '@/lib/composition';
import { ProfileExperience } from '@/components/profile/profile-experience';
export const metadata: Metadata = { title: 'โปรไฟล์ของฉัน · Reunite' };
export default async function ProfilePage() {
  const user = await requirePageUser();
  const profile = await services().profile.get(user.userId);
  return <ProfileExperience initial={profile} />;
}
