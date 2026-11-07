import type { Metadata } from 'next';
import Link from 'next/link';
import { statusCatalog, statusCodes } from '@/components/status/status-catalog';
import styles from '@/components/status/status.module.css';
export const metadata: Metadata = {
  title: 'หน้าสถานะ · Reunite',
  robots: { index: false, follow: false },
};
export default function SystemStates() {
  return (
    <main className={styles.gallery}>
      <Link href="/dashboard" className={styles.brand}>
        reunite<span>.</span>
      </Link>
      <h1>ทุกเส้นทาง มีทางไปต่อ</h1>
      <p>
        ตัวอย่างหน้าสถานะในธีมเพื่อนช่วยหา
        แต่ละหน้ามีเรื่องราวและภาพประกอบของตัวเอง
      </p>
      <p>
        หน้านี้เป็นพื้นที่ตรวจแบบ สถานะ 3xx จริงยังคงเปลี่ยนเส้นทางตามปกติ และ
        API ยังคงตอบ JSON ตามสัญญาเดิม
      </p>
      {(['3', '4', '5'] as const).map((family) => (
        <section key={family} aria-labelledby={`family-${family}`}>
          <h2 id={`family-${family}`}>
            {family === '3'
              ? '3xx · ไปต่ออีกเส้นทาง'
              : family === '4'
                ? '4xx · แวะตรวจเบาะแส'
                : '5xx · ให้สถานีได้ตั้งหลัก'}
          </h2>
          <div className={styles.galleryGrid}>
            {statusCodes
              .filter((code) => code.startsWith(family))
              .map((code) => (
                <Link
                  prefetch={false}
                  key={code}
                  href={`/status/${code}`}
                  className={styles.galleryCard}
                >
                  <span>{code}</span>
                  <h3>{statusCatalog[code].title}</h3>
                  <p lang="en">{statusCatalog[code].label}</p>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
