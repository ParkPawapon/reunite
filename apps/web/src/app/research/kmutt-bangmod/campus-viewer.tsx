'use client';

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import { detailedWebModelUrl, modelUrl, satelliteUrl } from './catalog';
import { CampusModel } from './campus-model';
import { CampusPlan } from './campus-plan';
import { CampusPlacePopup } from './campus-place-popup';
import { PlaceSearch } from './place-search';
import { LocationControls } from './location-controls';
import { placesById } from './places';
import { OriginPicker, WalkPlanner } from './walk-planner';
import { useLivePosition } from './use-live-position';
import { useWalkNavigation } from './use-walk-navigation';
import {
  findWalk,
  findWalkFromPosition,
  walkingEndpoints,
  walkingMinutes,
  type WalkRoute,
} from './walking';
import styles from './viewer.module.css';

const modes = [
  { id: 'plan', label: 'แผนที่ 2 มิติ', icon: 'map', asset: null },
  { id: 'light', label: '3D แบบเบา', icon: 'box', asset: modelUrl },
  {
    id: 'detail',
    label: '3D แบบละเอียด',
    icon: 'layers',
    asset: detailedWebModelUrl,
  },
] as const;

function subscribeToPlace(change: () => void) {
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
}

function currentHash() {
  return window.location.hash.slice(1);
}

function selectWalk(from: string, to: string) {
  const parameters = new URLSearchParams(currentHash());
  for (const [name, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (value) parameters.set(name, value);
    else parameters.delete(name);
  }
  parameters.delete('place');
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
  };
}

export function CampusViewer() {
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]);
  const [follow, setFollow] = useState(false);
  const [showLocationRequest, setShowLocationRequest] = useState(false);
  const [locationRoute, setLocationRoute] = useState<WalkRoute | null>(null);
  const [failedLocationHash, setFailedLocationHash] = useState<string | null>(
    null,
  );
  const mapLocation = useLivePosition();
  const hash = useSyncExternalStore(subscribeToPlace, currentHash, () => '');
  const locationUnavailable = failedLocationHash === hash;
  const { from, to, selected } = useMemo(() => readPlan(hash), [hash]);
  const route = useMemo(
    () =>
      from === 'live-origin' && locationRoute?.to.id === to
        ? locationRoute
        : findWalk(from, to),
    [from, to, locationRoute],
  );
  const navigation = useWalkNavigation(route);
  const { current, liveFix, arrived } = navigation;
  const walking = current !== null;
  const mapFix =
    mapLocation.state.status === 'live' ? mapLocation.state.fix : null;
  const startButton = useRef<HTMLButtonElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const focusSearch = useRef(false);
  const navigationHeading = useRef<HTMLHeadingElement>(null);
  const focusNavigation = useRef(false);
  useLayoutEffect(() => {
    if (!focusNavigation.current) return;
    const target = walking ? navigationHeading.current : startButton.current;
    target?.focus({ preventScroll: walking });
    if (walking) window.scrollTo({ top: 0, behavior: 'instant' });
    focusNavigation.current = false;
  }, [walking]);
  const activeRoute = locationUnavailable ? null : (current?.route ?? route);
  const progress = current?.progress ?? null;
  const metres = walking
    ? progress && 'remaining' in progress
      ? progress.remaining
      : null
    : (activeRoute?.metres ?? null);
  const followAction = walking
    ? { enabled: !arrived && liveFix !== null, onClick: () => setFollow(true) }
    : {
        enabled: true,
        onClick: () => {
          setFollow(true);
          if (!mapFix) {
            if (selected) dismissPlace();
            openLocationRequest();
          }
        },
      };
  const following = follow && (walking || mapFix !== null);
  const pauseFollow = useCallback(() => setFollow(false), []);
  const place = selected ? placesById.get(selected) : undefined;
  const noRoute =
    route === null &&
    from !== to &&
    Object.hasOwn(walkingEndpoints, from) &&
    Object.hasOwn(walkingEndpoints, to);
  const choosingOrigin =
    !route && !noRoute && Object.hasOwn(walkingEndpoints, to);
  const priorFocus = useRef<HTMLElement | SVGElement | null>(null);
  const returnFocus = useRef(false);
  const originHeading = useRef<HTMLHeadingElement>(null);
  const focusOrigin = useRef(false);
  const focusPreview = useRef(false);

  useLayoutEffect(() => {
    if (noRoute) {
      focusPreview.current = false;
      searchField.current?.focus({ preventScroll: true });
    }
  }, [noRoute]);

  useLayoutEffect(() => {
    if (
      focusSearch.current &&
      !choosingOrigin &&
      !route &&
      !walking &&
      !showLocationRequest
    ) {
      searchField.current?.focus({ preventScroll: true });
      focusSearch.current = false;
    }
    if (!place && returnFocus.current) {
      priorFocus.current?.focus({ preventScroll: true });
      returnFocus.current = false;
    }
    if (
      choosingOrigin &&
      !place &&
      !showLocationRequest &&
      focusOrigin.current
    ) {
      originHeading.current?.focus({ preventScroll: true });
      focusOrigin.current = false;
    }
    if (route && !walking && !showLocationRequest && focusPreview.current) {
      startButton.current?.focus({ preventScroll: true });
      focusPreview.current = false;
    }
  }, [place, choosingOrigin, route, to, from, walking, showLocationRequest]);

  const selectPlace = useCallback((id: string) => {
    setShowLocationRequest(false);
    const active = document.activeElement;
    if (active instanceof HTMLElement || active instanceof SVGElement)
      priorFocus.current = active;
    const parameters = new URLSearchParams(currentHash());
    parameters.set('place', id);
    window.location.hash = parameters.toString();
  }, []);

  function dismissPlace() {
    returnFocus.current = true;
    const parameters = new URLSearchParams(currentHash());
    parameters.delete('place');
    window.location.hash = parameters.toString();
  }

  function chooseOrigin(id: string) {
    mapLocation.stop();
    setFailedLocationHash(null);
    focusPreview.current = true;
    selectWalk(id, to);
  }

  function selectMapPlace(id: string) {
    if (
      !showLocationRequest &&
      (choosingOrigin ||
        (locationUnavailable && Object.hasOwn(walkingEndpoints, to)))
    ) {
      if (id !== to && Object.hasOwn(walkingEndpoints, id)) chooseOrigin(id);
      return;
    }
    selectPlace(id);
  }

  function openLocationRequest() {
    setFailedLocationHash(null);
    setShowLocationRequest(true);
  }

  function useLocation() {
    const requestedHash = currentHash();
    function showLocationWarning() {
      if (currentHash() !== requestedHash) return;
      mapLocation.stop();
      setFailedLocationHash(requestedHash);
      setShowLocationRequest(false);
    }
    mapLocation.stop();
    mapLocation.start((sample) => {
      if (currentHash() !== requestedHash || !sample) return;
      if (sample.status !== 'live') {
        showLocationWarning();
        return;
      }
      if (choosingOrigin) {
        const plan = findWalkFromPosition(
          sample.fix.point,
          sample.fix.accuracy,
          to,
        );
        if (!plan) {
          showLocationWarning();
          return;
        }
        mapLocation.stop();
        setLocationRoute(plan);
        focusPreview.current = true;
        selectWalk(plan.from.id, to);
      }
      setShowLocationRequest(false);
    }, showLocationWarning);
  }

  function startWalk() {
    focusNavigation.current = true;
    setShowLocationRequest(false);
    mapLocation.stop();
    setMode(modes[0]);
    setFollow(true);
    navigation.start();
  }

  function endWalk() {
    focusNavigation.current = walking;
    navigation.end();
  }

  return (
    <div
      className={styles.viewer}
      data-walking={walking}
      data-place-selected={Boolean(place)}
    >
      <section
        aria-label="แผนที่วิทยาเขต"
        className={styles.map}
        data-mode={mode.id}
      >
        <details className={styles.mapModes}>
          <summary aria-label="รูปแบบแผนที่">
            <ShellIcon name="layers" />
            <span>รูปแบบแผนที่</span>
            <ShellIcon className={styles.mapModesChevron} name="chevron" />
          </summary>
          <div
            className={styles.mapModeOptions}
            role="group"
            aria-label="ตัวเลือกรูปแบบแผนที่"
          >
            {modes.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={mode.id === option.id}
                onClick={(event) => {
                  setMode(option);
                  const details = event.currentTarget.closest('details');
                  if (details) {
                    details.open = false;
                    details.querySelector('summary')?.focus();
                  }
                }}
              >
                <ShellIcon name={option.icon} />
                <span>{option.label}</span>
                {mode.id === option.id && <ShellIcon name="check" />}
              </button>
            ))}
            <div className={styles.mapModeFooter}>
              <a href={satelliteUrl} target="_blank" rel="noreferrer">
                <ShellIcon name="pin" />
                <span>
                  ภาพดาวเทียม <small lang="en">Google Maps</small>
                </span>
                <ShellIcon name="external" />
              </a>
            </div>
          </div>
        </details>
        {mode.asset ? (
          <CampusModel
            key={mode.id}
            assetUrl={mode.asset}
            place={place}
            route={activeRoute}
            liveFix={walking ? liveFix : mapFix}
            following={following}
            progress={progress}
            navigating={walking}
            onPan={pauseFollow}
            followAction={followAction}
            onSelect={selectMapPlace}
            onBack={() => setMode(modes[0])}
          />
        ) : (
          <div className={styles.viewport} data-render-state="plan">
            <CampusPlan
              key={from + ':' + to}
              place={place}
              route={activeRoute}
              liveFix={walking ? liveFix : mapFix}
              following={following}
              progress={progress}
              navigating={walking}
              arrived={arrived}
              onPan={pauseFollow}
              followAction={followAction}
              onSelect={selectMapPlace}
            />
          </div>
        )}
        {metres !== null && !arrived && (
          <p className={styles.mapEstimate}>
            <ShellIcon name="user" /> {Math.ceil(walkingMinutes(metres))} นาที ·
            ประมาณ {walking ? Math.ceil(metres) : Math.round(metres / 10) * 10}{' '}
            เมตร
          </p>
        )}
        {place && (
          <CampusPlacePopup
            key={place.id}
            place={place}
            onDismiss={dismissPlace}
            onDirections={
              !walking && Object.hasOwn(walkingEndpoints, place.id)
                ? () => {
                    focusOrigin.current = true;
                    selectWalk('', place.id);
                  }
                : undefined
            }
          />
        )}
        <p className={styles.attribution}>
          <a href="https://www.openstreetmap.org/copyright" lang="en">
            © OpenStreetMap
          </a>
          <a href="/research/kmutt-bangmod#sources">แหล่งข้อมูล</a>
        </p>
      </section>
      <aside className={styles.navigation} aria-label="การเดินในวิทยาเขต">
        {!walking && showLocationRequest ? (
          <section
            className={styles.locationRequest}
            aria-labelledby="campus-location-request"
          >
            <h1 id="campus-location-request" className={styles.destination}>
              เริ่มจากตำแหน่งของคุณ
            </h1>
            <p className={styles.walkNote}>
              {choosingOrigin
                ? 'ใช้ตำแหน่งเฉพาะตอนดูเส้นทางเดิน'
                : 'ใช้ตำแหน่งเฉพาะตอนดูแผนที่และเส้นทางเดิน'}
            </p>
            {['requesting', 'searching'].includes(mapLocation.state.status) && (
              <p role="status" className={styles.walkNote}>
                กำลังรอตำแหน่งล่าสุด…
              </p>
            )}
            <button
              className={styles.primaryAction}
              type="button"
              onClick={useLocation}
            >
              ใช้ตำแหน่งของฉัน
            </button>
            <button
              className={styles.secondaryAction}
              type="button"
              onClick={() => {
                mapLocation.stop();
                setShowLocationRequest(false);
                if (choosingOrigin) focusOrigin.current = true;
                else focusSearch.current = true;
              }}
            >
              เลือกอาคารต้นทาง
            </button>
          </section>
        ) : (
          !walking &&
          (locationUnavailable || (!choosingOrigin && !route)) && (
            <PlaceSearch
              selected={place?.id}
              onSelect={locationUnavailable ? selectMapPlace : selectPlace}
              searchRef={searchField}
              noRoute={noRoute}
              locationUnavailable={locationUnavailable}
            />
          )
        )}
        {!walking &&
          !showLocationRequest &&
          !locationUnavailable &&
          choosingOrigin && (
            <OriginPicker
              destination={to}
              headingRef={originHeading}
              onSelect={chooseOrigin}
              onUseLocation={openLocationRequest}
            />
          )}
        {!walking && !showLocationRequest && !locationUnavailable && route && (
          <WalkPlanner
            startRef={startButton}
            onStart={startWalk}
            route={route}
          />
        )}
        {walking && (
          <LocationControls
            gps={navigation.gps}
            headingRef={navigationHeading}
            destination={
              placesById.get(to)?.building?.code ??
              placesById.get(to)?.label ??
              to
            }
            arrived={arrived}
            rerouting={current.phase === 'rerouting'}
            recovery={current.phase === 'recovery'}
            onRetry={() => {
              navigationHeading.current?.focus({ preventScroll: true });
              navigation.start();
            }}
            onEnd={endWalk}
            onChooseOrigin={() => {
              navigation.end();
              focusOrigin.current = true;
              selectWalk('', to);
            }}
            onFinish={() => {
              focusSearch.current = true;
              navigation.end();
              selectWalk('', '');
            }}
            progress={progress}
            route={current.route}
          />
        )}
      </aside>
    </div>
  );
}
