import type { Metadata } from 'next';
import { LandingExperience } from '@/components/landing/landing-experience';

export const metadata: Metadata = {
  title: 'Reunite · ของหายยังมีทางกลับ',
  description:
    'รู้จัก Reunite พื้นที่ของหายและของที่พบของคนบางมด พร้อมแผนที่เดินในวิทยาเขตและทีมผู้จัดทำ',
};

export default function LandingPage() {
  return <LandingExperience />;
}
