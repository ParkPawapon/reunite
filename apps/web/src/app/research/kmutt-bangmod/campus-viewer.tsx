'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  detailedWebModelUrl,
  heightBasis,
  modelUrl,
  satelliteUrl,
} from './catalog';
import { CampusModel } from './campus-model';
import { CampusPlan } from './campus-plan';
import { LocationControls } from './location-controls';
import {
  findPlaces,
  placeFragment,
  placesById,
  placeSatelliteUrl,
} from './places';
import { WalkPlanner } from './walk-planner';
import { useLivePosition } from './use-live-position';
import { findWalk } from './walking';
import styles from './viewer.module.css';

const modes = [
  { id: 'plan', label: 'แผนที่ 2 มิติ', asset: null },
  { id: 'light', label: '3D แบบเบา', asset: modelUrl },
  { id: 'detail', label: '3D แบบละเอียด', asset: detailedWebModelUrl },
] as const;
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 });

function subscribeToPlace(change: () => void) {
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
}

function currentHash() {
  return window.location.hash.slice(1);
}

function selectPlace(id: string) {
  const parameters = new URLSearchParams(currentHash());
  parameters.set('place', id);
  window.location.hash = parameters.toString();
}

function selectWalk(from: string, to: string) {
  const parameters = new URLSearchParams(currentHash());
  if (from && to) {
    parameters.set('from', from);
    parameters.set('to', to);
  } else {
    parameters.delete('from');
    parameters.delete('to');
  }
  window.location.hash = parameters.toString();
}

function readPlan(hash: string) {
  const parameters = new URLSearchParams(hash);
  const from = parameters.get('from') ?? '';
  const to = parameters.get('to') ?? '';
  return {
    from,
    to,
    selected: parameters.get('place'),
    route: findWalk(from, to),
  };
}

export function CampusViewer() {
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]);
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(false);
  const [copyStatus, setCopyStatus] = useState<{
    id: string;
    fallbackUrl?: string;
  }>();
  const hash = useSyncExternalStore(subscribeToPlace, currentHash, () => '');
  const { from, to, selected, route } = useMemo(() => readPlan(hash), [hash]);
  const gps = useLivePosition();
  const liveFix = gps.state.status === 'live' ? gps.state.fix : null;
  const following = Boolean(liveFix && follow);
  const place = selected ? placesById.get(selected) : undefined;
  const building = place?.building;
  const matches = findPlaces(query);
  const sources = new Map(
    building?.footprintSources.map((source) => [
      source.id ?? source.url,
      source,
    ]),
  );

  async function copyLink(id: string) {
    const url = new URL(placeFragment(id), window.location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus({ id });
    } catch {
      setCopyStatus({ id, fallbackUrl: url });
    }
  }

  return (
    <div className={styles.viewer}>
      <section className={styles.catalog} aria-labelledby="campus-buildings">
        <h2 id="campus-buildings">ค้นหาอาคาร พื้นที่ และประตูวิทยาเขต</h2>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const [match] = matches;
            if (match && matches.length === 1) selectPlace(match.id);
          }}
        >
          <label className={styles.search}>
            รหัสอาคาร ชื่อพื้นที่ หรือประตู
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="เช่น N16, FIBO, ประตู 1"
            />
          </label>
        </form>
        <ul className={styles.results} aria-label="ผลการค้นหา">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={item.id === place?.id}
                onClick={() => selectPlace(item.id)}
              >
                <strong>
                  {item.building?.code ??
                    (item.kind === 'gate' ? 'ประตู' : 'พื้นที่')}
                </strong>
                <span>{item.nameTh}</span>
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 && (
          <p role="status">ไม่พบอาคารหรือพื้นที่กลางแจ้งที่ตรงกับคำค้น</p>
        )}
      </section>
      <section aria-label="แผนที่วิทยาเขต" className={styles.map}>
        <WalkPlanner
          from={from}
          to={to}
          route={route}
          onWalk={selectWalk}
          onClear={() => selectWalk('', '')}
        />
        <LocationControls
          gps={{
            ...gps,
            start() {
              setFollow(false);
              gps.start();
            },
          }}
          route={route}
          following={following}
          onFollow={() => setFollow(!follow)}
        />
        <div className={styles.controls} role="group" aria-label="รูปแบบแผนที่">
          {modes.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode.id === option.id}
              onClick={() => setMode(option)}
            >
              {option.label}
            </button>
          ))}
          <a href={satelliteUrl} target="_blank" rel="noreferrer">
            ภาพดาวเทียม Google Maps ↗
          </a>
        </div>
        {mode.asset ? (
          <CampusModel
            key={mode.id}
            assetUrl={mode.asset}
            place={place}
            route={route}
            liveFix={liveFix}
            following={following}
            onSelect={selectPlace}
            onBack={() => setMode(modes[0])}
          />
        ) : (
          <div className={styles.viewport} data-render-state="plan">
            <CampusPlan
              place={place}
              route={route}
              liveFix={liveFix}
              following={following}
              onSelect={selectPlace}
            />
          </div>
        )}
      </section>
      <section
        className={styles.details}
        aria-label="ข้อมูลตำแหน่งที่เลือก"
        aria-live="polite"
      >
        {place ? (
          <>
            <h3>{place.label}</h3>
            {building && <p lang="en">{building.nameEn}</p>}
            <p className={styles.hint}>
              {building
                ? 'หมุดอยู่ในขอบเขตฐานอาคารโดยประมาณ'
                : place.kind === 'gate'
                  ? 'ตำแหน่งประตูเทียบจากผังมหาวิทยาลัยและ OpenStreetMap · ตรวจการเปิดใช้งานหน้างาน'
                  : 'หมุดอยู่ในขอบเขตพื้นที่จากแผนที่เปิด'}
            </p>
            <div className={styles.placeActions}>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => void copyLink(place.id)}
              >
                คัดลอกลิงก์ตำแหน่ง
              </button>
              <a
                href={placeSatelliteUrl(place)}
                target="_blank"
                rel="noreferrer"
              >
                เปิดภาพดาวเทียมที่ตำแหน่งนี้
              </a>
            </div>
            {copyStatus?.id === place.id &&
              (copyStatus.fallbackUrl ? (
                <label className={styles.search}>
                  ลิงก์สำหรับคัดลอก
                  <input
                    readOnly
                    value={copyStatus.fallbackUrl}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              ) : (
                <p role="status">คัดลอกลิงก์แล้ว</p>
              ))}
            {building && (
              <dl>
                <dt>ความสูงในโมเดล</dt>
                <dd>
                  {number.format(building.heightM)} ม. ·{' '}
                  {heightBasis[building.heightBasis]}
                </dd>
                <dt>พื้นที่ฐานในโมเดล</dt>
                <dd>
                  {number.format(building.footprintAreaM2)} ตร.ม. ·{' '}
                  {building.footprintBasis === 'mapped'
                    ? 'จากข้อมูลแผนที่เปิด'
                    : 'ร่างโดยประมาณจากผังมหาวิทยาลัย'}
                </dd>
                {building.floorCount != null && (
                  <>
                    <dt>จำนวนชั้นที่อ้างอิง</dt>
                    <dd>
                      {building.heightBasis === 'at-least-levels'
                        ? 'อย่างน้อย '
                        : ''}
                      {building.floorCount} ชั้น
                    </dd>
                  </>
                )}
              </dl>
            )}
            <ul className={styles.sources}>
              {building && (
                <li>
                  <a
                    href={`https://bgm.kmutt.ac.th/MapNavi/${building.code}.html`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ภาพอาคารอ้างอิงจาก มจธ.
                  </a>
                </li>
              )}
              {[...sources].map(([key, source]) => (
                <li key={key}>
                  <a href={source.url}>
                    แหล่งข้อมูลฐานอาคาร
                    {source.id
                      ? ` · ${source.kind === 'osm' ? source.id : source.upstream}`
                      : ''}
                  </a>
                </li>
              ))}
              {!building && (
                <li>
                  <a href={place.source}>
                    {place.kind === 'gate'
                      ? 'พิกัดประตูใน OpenStreetMap'
                      : 'แหล่งข้อมูลขอบเขตพื้นที่'}
                  </a>
                </li>
              )}
              {building?.heightSource && (
                <li>
                  <a href={building.heightSource}>หลักฐานจำนวนชั้น</a>
                </li>
              )}
            </ul>
          </>
        ) : (
          <p>เลือกอาคารหรือพื้นที่เพื่อปักหมุด ดูแหล่งข้อมูล และแชร์ตำแหน่ง</p>
        )}
      </section>
    </div>
  );
}
