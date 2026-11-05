import type { Metadata } from 'next';
import { LoadingScreen } from '@/components/loading/loading-screen';

export const metadata: Metadata = {
  title: 'ตัวอย่าง Loading Screen — Reunite',
  robots: { index: false, follow: false },
};

export default function LoadingPreview() {
  return (
    <main>
      <h1 className="sr-only">ตัวอย่างหน้ากำลังโหลด</h1>
      <LoadingScreen />
    </main>
  );
}
