import type { Metadata } from 'next';
import { StatusExperience } from '@/components/status/status-experience';
import { fontVariables } from '@/theme/fonts';
import './globals.css';
export const metadata: Metadata = {
  title: 'ไม่พบหน้านี้ · Reunite',
  robots: { index: false, follow: false },
};
export default function GlobalNotFound() {
  return (
    <html lang="th" className={fontVariables}>
      <body>
        <StatusExperience code="404" />
      </body>
    </html>
  );
}
