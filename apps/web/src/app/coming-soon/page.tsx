import type { Metadata } from 'next';
import { ComingSoonExperience } from '@/components/coming-soon/coming-soon-experience';
import {
  LAUNCH_DATE_LABEL,
  LAUNCH_TIME_LABEL,
} from '@/components/coming-soon/launch';

export const metadata: Metadata = {
  title: `Reunite — พบกัน ${LAUNCH_DATE_LABEL}`,
  description: `อีกไม่นาน จะมีเพื่อนช่วยหาของหายที่บางมด เปิดภารกิจพร้อมกัน ${LAUNCH_DATE_LABEL} เวลา ${LAUNCH_TIME_LABEL} น. ตามเวลาไทย`,
};

export default function ComingSoonPage() {
  return <ComingSoonExperience />;
}
