import type { Metadata } from 'next';
import { LegacyMapRedirect } from './legacy-map-redirect';
import {
  assets,
  campusTourUrl,
  detailedModelUrl,
  modelUrl,
  satelliteUrl,
} from './catalog';
import styles from './research.module.css';

export const metadata: Metadata = {
  title: 'งานศึกษาโมเดลสามมิติ มจธ. บางมด · Reunite',
  description:
    'โมเดลภายนอกสามมิติแบบละเอียดของมหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี วิทยาเขตบางมด',
};

export default function BangmodResearchPage() {
  return (
    <main className={styles.study}>
      <LegacyMapRedirect />
      <header>
        <h1>งานศึกษาโมเดลสามมิติ มจธ. บางมด</h1>
        <a href="/map">เปิดแผนที่บางมด</a>
      </header>
      <section aria-label="โมเดลและภาพอาคาร">
        <p>
          โมเดลสำหรับการศึกษาใช้ข้อมูลฐานอาคารจากแผนที่เปิด
          และอ้างอิงภาพภายนอกจากมหาวิทยาลัยครบ 35 รหัสอาคาร ความสูง มิติรูปด้าน
          และหลังคาบางส่วนเป็นค่าประมาณ
        </p>
        <nav
          aria-label="ดาวน์โหลดไฟล์สำหรับการศึกษา"
          className={styles.downloads}
        >
          <a href={detailedModelUrl} download>
            ดาวน์โหลด GLB ฉบับละเอียด
          </a>
          <a href={modelUrl} download>
            GLB แบบมวลอาคาร
          </a>
          <a href={`${assets}/kmutt-bangmod.geojson`} download>
            ฐานอาคาร GeoJSON
          </a>
          <a href={`${assets}/kmutt-bangmod.csv`} download>
            ตารางอาคาร CSV
          </a>
        </nav>
        <p>
          <a href={`${assets}/bangmod-campus.webp`}>ภาพเรนเดอร์ทั้งวิทยาเขต</a>{' '}
          · <a href={`${assets}/bangmod-lx.webp`}>ภาพระยะใกล้อาคาร LX</a> ·{' '}
          <a href={`${assets}/bangmod-lx-plaza.webp`}>LX มุมระดับคนเดิน</a> ·{' '}
          <a href={`${assets}/bangmod-lx-roof.webp`}>LX มุมสูงและแผงโซลาร์</a> ·{' '}
          <a href={`${assets}/bangmod-s3.webp`}>ภาพระยะใกล้อาคาร S3</a> ·{' '}
          <a href={`${assets}/bangmod-fibo.webp`}>ภาพระยะใกล้อาคาร FIBO</a> ·{' '}
          <a href={`${assets}/bangmod-s4.webp`}>ภาพกลุ่มอาคารวิศววัฒนะ</a> ·{' '}
          <a href={`${assets}/bangmod-s15.webp`}>ภาพทางเข้าอาคาร S15</a> ·{' '}
          <a href={`${assets}/bangmod-n7.webp`}>N7 ส่วนอาคารสูงและส่วนเตี้ย</a>{' '}
          · <a href={`${assets}/bangmod-n11.webp`}>ทางเข้า N11</a> ·{' '}
          <a href={`${assets}/bangmod-s14.webp`}>
            หลังคาอาคารพระจอมเกล้าราชานุสรณ์
          </a>{' '}
          · <a href={`${assets}/bangmod-n13.webp`}>โครงโค้งเรือนกระจก N13</a> ·{' '}
          <a href={`${assets}/bangmod-n10.webp`}>โถงกระจกและบันไดหอสมุด</a> ·{' '}
          <a href={`${assets}/bangmod-n20.webp`}>รูปด้าน N20 แยกอาคาร</a> ·{' '}
          <a href={`${assets}/bangmod-s14-entry.webp`}>โครงถักทางเข้า S14</a> ·{' '}
          <a href={campusTourUrl} target="_blank" rel="noreferrer">
            Virtual Tour ของ มจธ.
          </a>{' '}
          ·{' '}
          <a href={satelliteUrl} target="_blank" rel="noreferrer">
            เทียบมุมดาวเทียมใน Google Maps
          </a>
        </p>
        <p id="sources">
          <a href="https://www.openstreetmap.org/copyright">
            © OpenStreetMap contributors
          </a>{' '}
          ·{' '}
          <a href="https://docs.overturemaps.org/attribution/">
            Overture Maps Foundation
          </a>{' '}
          ·{' '}
          <a href="https://github.com/microsoft/GlobalMLBuildingFootprints">
            Microsoft Global ML Building Footprints
          </a>{' '}
          ·{' '}
          <a href="https://sites.research.google/gr/open-buildings/">
            Google Open Buildings
          </a>{' '}
          ·{' '}
          <a href="https://bgm.kmutt.ac.th/MapNavi/MAPNAVI.html">
            ผังแม่บท มจธ. บางมด
          </a>{' '}
          ·{' '}
          <a href={`${assets}/site-context.geojson`} download>
            ข้อมูลแนวถนนและทางเดิน GeoJSON
          </a>{' '}
          ·{' '}
          <a href={`${assets}/walking-network.json`} download>
            โครงข่ายเดินเท้าและจุดประตู
          </a>{' '}
          · <a href={`${assets}/NOTICE.txt`}>ที่มาและสิทธิ์การใช้ข้อมูล</a>
        </p>
      </section>
    </main>
  );
}
