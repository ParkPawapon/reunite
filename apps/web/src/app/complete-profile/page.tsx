import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CompleteProfileForm } from '@/components/auth/complete-profile-form';
import { services } from '@/lib/composition';
import { requirePageSession } from '@/modules/auth/presentation/require-page-user';

export const metadata: Metadata = {
  title: 'ตั้งค่าโปรไฟล์ · Reunite',
  robots: { index: false, follow: false },
};

export default async function CompleteProfilePage() {
  const session = await requirePageSession();
  if (!session.profileCompletionRequired) redirect('/dashboard');
  const { studentId, faculty, department, major } =
    await services().profile.get(session.profile.userId);
  return (
    <CompleteProfileForm initial={{ studentId, faculty, department, major }} />
  );
}
