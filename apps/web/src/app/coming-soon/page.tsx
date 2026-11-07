import type { Metadata } from 'next';
import { ComingSoonExperience } from '@/components/coming-soon/coming-soon-experience';

export const metadata: Metadata = {
  title: 'Reunite — พบกัน 24 พฤศจิกายน 2569',
  description:
    'อีกไม่นาน จะมีเพื่อนช่วยหาของหายที่บางมด เปิดภารกิจพร้อมกัน 24 พฤศจิกายน 2569 เวลา 00:00 น. ตามเวลาไทย',
};

export default function ComingSoonPage() {
  return <ComingSoonExperience />;
}
