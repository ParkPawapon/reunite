import Link from 'next/link';
import { findWalk } from '@/app/research/kmutt-bangmod/walking';
import {
  LAUNCH_DATE,
  LAUNCH_DATE_LABEL,
} from '@/components/coming-soon/launch';
import { LandingFrame } from './landing-frame';
import { GooseStage } from './goose-stage';
import { SceneImage } from './scene-image';
import { StoryRoute } from './story-route';
import styles from './landing.module.css';

const campus = '/research/kmutt-bangmod';
const walk = { from: 'N7', to: 'S3' } as const;
const foundAt = `หน้าอาคาร ${walk.to}`;
const exampleRoute = findWalk(walk.from, walk.to);
const walkLink = exampleRoute
  ? `${campus}#${new URLSearchParams(walk)}`
  : campus;
const contributors = ['ParkPawapon', 'milky-way-miw', 'Ch3323'] as const;

export function LandingExperience() {
  return (
    <LandingFrame>
      <main id="landing-content" tabIndex={-1}>
        <section
          className={styles.hero}
          aria-labelledby="landing-title"
          data-landing-hero
        >
          <div
            className={styles.campusEtching}
            data-parallax="70"
            aria-hidden="true"
          />
          <div className={styles.heroScreen}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker} lang="en">
                LOST &amp; FOUND · KMUTT
              </p>
              <h1 id="landing-title">
                ของหาย <span>ยังมีทางกลับ</span>
              </h1>
              <p className={styles.heroLead}>
                บางครั้งของที่เรากำลังตามหา
                อาจอยู่กับใครสักคนที่กำลังตามหาเจ้าของ Reunite
                พาคนบางมดมาเจอกันในที่เดียว
              </p>
              <div className={styles.actions}>
                <Link className={styles.primary} href="/login" prefetch={false}>
                  เข้าสู่ระบบ
                </Link>
                <a className={styles.secondary} href="#story">
                  รู้จัก Reunite
                </a>
              </div>
              <p className={styles.release}>
                เปิดตัว <time dateTime={LAUNCH_DATE}>{LAUNCH_DATE_LABEL}</time>
              </p>
            </div>
            <GooseStage />
          </div>
        </section>

        <section
          className={styles.story}
          id="story"
          aria-labelledby="story-title"
          data-report-story
        >
          <div className={styles.storyScreen}>
            <div className={styles.storyIntro} data-reveal>
              <p className={styles.kicker}>เรื่องเล่าของร่มหนึ่งคัน</p>
              <h2 id="story-title">ใครลืมร่มไว้?</h2>
              <p>
                หลังเลิกเรียน เจ้าของเดินกลับไปที่เดิมแล้วไม่เจอร่ม
                ระหว่างนั้นมีคนเก็บร่มได้ที่{foundAt} และลงประกาศพร้อมรูปถ่าย
              </p>
            </div>
            <article
              className={styles.report}
              aria-labelledby="sample-title"
              data-scene
            >
              <div className={styles.reportPaper} aria-hidden="true" />
              <p className={styles.reportLabel}>
                ตัวอย่างประกาศ <span>ของที่พบ</span>
              </p>
              <div className={styles.reportPhoto} data-attachment>
                <SceneImage
                  className={styles.umbrella}
                  src="/landing/umbrella-attachment.webp"
                  alt="รูปแนบแสดงร่มพับสีน้ำเงินและสายรัดสีฟ้า"
                  width={640}
                  height={640}
                  sizes="(max-width: 760px) 84vw, 460px"
                />
              </div>
              <div className={styles.reportDetails}>
                <h3 id="sample-title">ร่มพับสีน้ำเงิน</h3>
                <dl className={styles.reportLocation}>
                  <dt>จุดที่พบ</dt>
                  <dd>{foundAt}</dd>
                </dl>
              </div>
            </article>
          </div>
        </section>

        <section
          className={styles.campus}
          id="campus"
          aria-labelledby="campus-title"
          data-scene
          data-route-story
        >
          <SceneImage
            className={styles.campusArt}
            depth={90}
            src={`${campus}/bangmod-campus.webp`}
            alt=""
            fill
            sizes="100vw"
          />
          <div className={styles.campusShade} />
          <div className={styles.campusCopy} data-reveal>
            <p className={styles.kicker}>แผนที่บางมด</p>
            <h2 id="campus-title">เดินไปรับร่ม</h2>
            <p>
              เจ้าของจำสายรัดสีฟ้าในรูปได้ จึงนัดรับร่มที่จุดเดิม จากอาคาร{' '}
              {walk.from} เปิดแผนที่แล้วเดินไปที่{foundAt}
            </p>
            <a className={styles.campusLink} href={walkLink}>
              เปิดแผนที่บางมด
            </a>
          </div>
          {exampleRoute && <StoryRoute route={exampleRoute} />}
          <a className={styles.mapCredit} href={`${campus}/NOTICE.txt`}>
            ที่มาข้อมูลแผนที่และโมเดล
          </a>
        </section>

        <section
          className={styles.reunion}
          aria-labelledby="return-title"
          data-scene
        >
          <div
            className={styles.reunionLight}
            data-parallax="82"
            aria-hidden="true"
          />
          <SceneImage
            className={styles.reunionArt}
            depth={-65}
            src="/landing/umbrella-return-courtyard.webp"
            alt="ห่านผ้าพันคอส่งร่มพับสีน้ำเงินคืนให้ห่านหมวกส้ม"
            fill
            sizes="100vw"
          />
          <div className={styles.reunionShade} aria-hidden="true" />
          <div className={styles.reunionCopy} data-reveal>
            <h2 id="return-title">ร่มได้กลับไปหาเจ้าของ</h2>
            <p>ขอบคุณที่เก็บไว้ให้</p>
          </div>
        </section>

        <section className={styles.team} id="team" aria-labelledby="team-title">
          <div data-reveal>
            <p className={styles.kicker} lang="en">
              REUNITE · KMUTT
            </p>
            <h2 id="team-title">ผู้จัดทำ</h2>
          </div>
          <ul className={styles.teamList}>
            {contributors.map((contributor) => (
              <li key={contributor} data-reveal>
                <a href={`https://github.com/${contributor}`}>
                  <span className={styles.initial} aria-hidden="true">
                    {contributor[0]?.toUpperCase()}
                  </span>
                  <span lang="en">{contributor}</span>
                  <small lang="en">GitHub</small>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.next} aria-labelledby="next-title">
          <div data-reveal>
            <h2 id="next-title">ของสำคัญ มีเจ้าของ</h2>
            <p>เริ่มตามหาได้ที่ Reunite</p>
          </div>
          <Link className={styles.primary} href="/login" prefetch={false}>
            เข้าสู่ระบบ
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <a href="#landing-top" className={styles.wordmark} lang="en">
          reunite<span>.</span>
        </a>
        <span>พาของสำคัญ กลับไปหาคนสำคัญ</span>
        <Link href="/coming-soon" prefetch={false}>
          วันเปิดตัว
        </Link>
      </footer>
    </LandingFrame>
  );
}
