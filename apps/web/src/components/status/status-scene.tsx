import type { ReactNode } from 'react';
import { GooseIllustration } from '@/components/loading/goose-illustration.generated';
import type { StatusSceneName } from './status-catalog';
import styles from './status.module.css';

function Prop({ scene }: { scene: StatusSceneName }): ReactNode {
  switch (scene) {
    case 'turnstile':
      return (
        <>
          <path d="M125 135h70v140h-70V135Z" fill="var(--color-orange-100)" />
          <circle cx="160" cy="150" r="17" className={styles.accent} />
          <path d="m160 150-90-55m90 55 90-55m-90 55v95M115 280h90" />
          <circle cx="80" cy="65" r="28" fill="var(--color-surface)" />
          <path d="m62 47 36 36m-36 0 36-36" className={styles.accent} />
        </>
      );
    case 'compare':
      return (
        <>
          <rect
            x="45"
            y="90"
            width="125"
            height="170"
            rx="12"
            fill="var(--color-orange-100)"
          />
          <rect
            x="135"
            y="125"
            width="125"
            height="170"
            rx="12"
            fill="var(--color-surface)"
          />
          <path
            d="M65 125h75m-75 25h45m45 15h80m-80 25h55M85 205h55m-17-17 17 17-17 17M210 230h-55m17-17-17 17 17 17"
            className={styles.accent}
          />
        </>
      );
    case 'blueprint':
      return (
        <>
          <path d="M45 110h180v150H45V110Z" fill="var(--color-orange-100)" />
          <path d="m65 240 125-105v105H65Zm75-40v25h30v-50l-30 25ZM65 80h165m-145 0v15m30-15v10m30-10v15m30-15v10m30-10v15" />
          <path
            d="M95 275h150m-95-160 65-55 20 24-65 55"
            className={styles.accent}
          />
        </>
      );
    case 'postbox':
      return (
        <>
          <path
            d="M75 100h100a28 28 0 0 1 28 28v95H75V100Z"
            fill="var(--color-orange-100)"
          />
          <path d="M75 223h128M100 140h70M140 223v90" />
          <path d="m95 180 30-20 30 20v28H95v-28Zm0 0 30 20 30-20" />
          <path d="M194 98V55h44v33h-44" className={styles.accent} />
        </>
      );
    case 'detour':
      return (
        <>
          <path
            d="m115 110-45 150h115l-45-150h-25Z"
            className={styles.accent}
          />
          <path d="M101 155h54M88 200h80M60 268h134" />
          <path d="M175 100h70m-25-25 25 25-25 25" strokeDasharray="7 8" />
        </>
      );
    case 'receipt':
      return (
        <>
          <path
            d="M80 70h130v210l-16-12-16 12-16-12-16 12-16-12-16 12-17-12-17 12V70Z"
            fill="var(--color-surface)"
          />
          <path d="M105 115h80M105 140h55M105 210h75" />
          <path d="m112 171 15 15 29-30" className={styles.accent} />
        </>
      );
    case 'bridge':
      return (
        <>
          <path d="M45 240h210M65 235V90m170 145V90M65 115q85 140 170 0M95 160v75m35-44v44m35-41v41m35-67v67" />
          <path d="M95 90h80m-22-22 22 22-22 22" className={styles.accent} />
        </>
      );
    case 'signpost':
      return (
        <>
          <path d="M140 60v250" />
          <path
            d="M140 80H65L40 105l25 25h75M140 160h90l25 25-25 25h-90"
            fill="var(--color-orange-100)"
          />
          <path
            d="M140 80h55l23 25-23 25h-55M140 160H85l-23 25 23 25h55"
            className={styles.accent}
          />
        </>
      );
    case 'papers':
      return (
        <>
          <path
            d="m85 70 112 25-40 180-112-25L85 70Z"
            fill="var(--color-orange-100)"
          />
          <path d="M110 90h110v185H110V90Z" fill="var(--color-surface)" />
          <path d="M132 125h65M132 150h55M132 215h40" />
          <path d="m148 175 25 25m-25 0 25-25" className={styles.accent} />
        </>
      );
    case 'badge':
      return (
        <>
          <path d="M125 115V65a35 35 0 0 1 70 0v50" />
          <rect
            x="75"
            y="105"
            width="155"
            height="165"
            rx="18"
            fill="var(--color-orange-100)"
          />
          <circle cx="150" cy="160" r="22" fill="var(--color-surface)" />
          <path d="M115 210a35 35 0 0 1 70 0M118 240h65" />
          <path d="M100 125h105" className={styles.accent} />
        </>
      );
    case 'gate':
      return (
        <>
          <path
            d="M70 110v200m160-200v200M70 145h160v60H70v-60Z"
            fill="var(--color-orange-100)"
          />
          <path
            d="m80 145 40 60m5-60 40 60m5-60 40 60"
            className={styles.accent}
          />
          <circle cx="70" cy="95" r="18" fill="var(--color-brand-yellow)" />
          <circle cx="230" cy="95" r="18" fill="var(--color-brand-yellow)" />
          <path d="M145 140V80a18 18 0 0 1 36 0v60" />
        </>
      );
    case 'trail':
      return (
        <>
          <path
            d="M60 260c120 0 150-145 40-145-65 0-60 80 0 80h80"
            strokeDasharray="5 11"
          />
          <path d="M175 195h55m-18-18 18 18-18 18" className={styles.accent} />
          <circle cx="105" cy="85" r="29" fill="var(--color-brand-yellow)" />
          <path d="M98 78c0-12 21-12 21 0 0 8-13 7-13 17m0 11v1" />
          <path d="m55 65 6-15m149 190 9 11" />
        </>
      );
    case 'hourglass':
      return (
        <>
          <path d="M75 65h140M75 280h140M95 70c0 80 40 70 50 100-10 30-50 20-50 105m100-205c0 80-40 70-50 100 10 30 50 20 50 105" />
          <path
            d="m112 110 33 40 33-40h-66Zm-5 140 38-45 38 45h-76Z"
            fill="var(--color-brand-yellow)"
            stroke="none"
          />
        </>
      );
    case 'empty-frame':
      return (
        <>
          <path d="M65 95h165v150H65V95Z" fill="var(--color-surface)" />
          <path d="m65 95 25 25h115l25-25M90 120v100h115V120M65 245l25-25m140 25-25-25" />
          <path d="M95 180c45-55 65 45 105-15" strokeDasharray="4 10" />
          <path d="M135 270h25m-12-25v25" className={styles.accent} />
        </>
      );
    case 'suitcase':
      return (
        <>
          <rect
            x="48"
            y="95"
            width="190"
            height="180"
            rx="20"
            fill="var(--color-orange-100)"
          />
          <path d="M103 95V65h80v30M85 100v170m112-170v170M50 180h185M75 275v20m135-20v20" />
          <path d="M117 164h50v32h-50v-32Z" className={styles.accent} />
        </>
      );
    case 'folder':
      return (
        <>
          <path
            d="M55 100h75l25 30h85v145H55V100Z"
            fill="var(--color-orange-100)"
          />
          <path
            d="M55 150h185l-25 125H30L55 150Z"
            fill="var(--color-surface)"
          />
          <path d="m110 200 35 35m-35 0 35-35" className={styles.accent} />
          <path d="M160 85h50v65m-50-65v65" strokeDasharray="6 7" />
        </>
      );
    case 'puzzle':
      return (
        <>
          <path
            d="M60 140h60c-35-70 65-70 30 0h60v55c70-35 70 65 0 30v55H60v-55c70 35 70-65 0-30v-55Z"
            fill="var(--color-orange-100)"
          />
          <path
            d="m180 80 28-35 20 16c-5-30 30-35 29-9l18 15-28 35-22-18c5 30-30 35-29 9l-16-13Z"
            className={styles.accent}
          />
        </>
      );
    case 'queue':
      return (
        <>
          <path d="M50 240h195M75 235V130m85 105V130m80 105V130M75 150q40 65 85 0 40 65 80 0" />
          <circle cx="75" cy="113" r="17" className={styles.accent} />
          <circle cx="160" cy="113" r="17" fill="var(--color-brand-yellow)" />
          <circle cx="240" cy="113" r="17" fill="var(--color-orange-100)" />
          <path d="M95 75h65m-15-15 15 15-15 15" />
        </>
      );
    case 'tangle':
      return (
        <>
          <path
            d="M40 255c160 0 180-180 70-140-95 35 110 130 90 30-15-75-170 10-90 75 60 50 130-20 150-20"
            className={styles.accent}
          />
          <path d="m65 80 18-14m90 210 20 10M210 85l-5-18" />
          <circle cx="62" cy="245" r="28" fill="var(--color-orange-100)" />
          <path d="m52 225 18 40m-33-20h50" />
        </>
      );
    case 'radio':
      return (
        <>
          <path
            d="M85 140h120v140H85V140Zm35 0V60m15 135h45m-45 20h45m-45 20h45"
            fill="var(--color-orange-100)"
          />
          <path
            d="M145 105q25-30 45 0m-45-35q55-30 75 15"
            strokeDasharray="7 12"
          />
          <circle cx="112" cy="163" r="6" className={styles.accent} />
          <path d="m204 50 25 25m-25 0 25-25" />
        </>
      );
    case 'tea':
      return (
        <>
          <path
            d="M60 220h180M85 220v70m130-70v70M90 150h95v40a35 35 0 0 1-35 30h-25a35 35 0 0 1-35-30v-40Z"
            fill="var(--color-orange-100)"
          />
          <path d="M185 160h20c30 0 20 40-20 30M115 120c-20-20 20-25 0-45m45 45c-20-20 20-25 0-45" />
          <path d="M90 50h90" className={styles.accent} />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="145" cy="160" r="88" fill="var(--color-orange-100)" />
          <circle cx="145" cy="160" r="68" fill="var(--color-surface)" />
          <path d="M145 108v52l40 25M145 78V60M80 93 64 75m146 18 16-18M100 235l-20 35m110-35 20 35" />
          <path d="M145 147v18" className={styles.accent} />
        </>
      );
  }
}
export function StatusScene({ scene }: { scene: StatusSceneName }) {
  return (
    <div className={styles.scene} data-scene={scene} aria-hidden="true">
      <svg className={styles.sceneGround} viewBox="0 0 500 360" fill="none">
        <ellipse
          cx="255"
          cy="310"
          rx="218"
          ry="25"
          fill="var(--color-orange-100)"
        />
        <path
          d="M20 310h460"
          stroke="var(--color-orange-200)"
          strokeWidth="2"
        />
      </svg>
      <svg
        className={styles.sceneProp}
        viewBox="0 0 500 360"
        fill="none"
        stroke="var(--color-orange-800)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className={styles.prop}>
          <Prop scene={scene} />
        </g>
      </svg>
      <div className={styles.sceneGoose}>
        <GooseIllustration />
      </div>
      <span className={styles.sceneSpark}>✦</span>
    </div>
  );
}
