import type { Metadata } from 'next';
import { StatusExperience } from '@/components/status/status-experience';
export const metadata: Metadata = {
  title: 'ไม่พบหน้านี้ · Reunite',
  robots: { index: false, follow: false },
};
export default function NotFound() {
  return <StatusExperience code="404" />;
}
