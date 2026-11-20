import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import { findPlaces, mapPlaceName, placesById } from './places';
import styles from './viewer.module.css';

const featured = ['N16', 'N10', 'N7', 'S3'].flatMap((id) => {
  const place = placesById.get(id);
  return place ? [place] : [];
});

export function PlaceSearch({
  selected,
  onSelect,
  searchRef,
  noRoute,
  locationUnavailable,
}: {
  selected?: string;
  onSelect: (id: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  noRoute: boolean;
  locationUnavailable: boolean;
}) {
  const [query, setQuery] = useState('');
  const warning = useRef<HTMLParagraphElement>(null);
  const searching = Boolean(query.trim());
  const matches = searching ? findPlaces(query) : featured;
  useLayoutEffect(() => {
    if (locationUnavailable) warning.current?.focus({ preventScroll: true });
  }, [locationUnavailable]);

  return (
    <section
      className={styles.placeSearch}
      data-location-unavailable={locationUnavailable}
      aria-labelledby="campus-browse"
    >
      <h1 id="campus-browse">
        <span>แผนที่บางมด</span>
        <span>ไปไหนดี</span>
      </h1>
      <p className={styles.walkIntro}>เลือกจุดหมาย แล้วเดินไปด้วยกัน</p>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const [match] = matches;
          if (match && matches.length === 1) onSelect(match.id);
        }}
      >
        <label className={styles.search}>
          ค้นหาอาคารหรือสถานที่
          <span className={styles.searchInput}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m17 17 4 4" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="เช่น LX, ห้องสมุด, N7"
            />
          </span>
        </label>
        {(locationUnavailable || noRoute) && (
          <p
            className={styles.searchBanner}
            data-warning={locationUnavailable}
            role="alert"
            ref={warning}
            tabIndex={locationUnavailable ? -1 : undefined}
          >
            <ShellIcon name="alert" />
            {locationUnavailable
              ? 'ยังใช้ตำแหน่งไม่ได้ เลือกต้นทางเองได้'
              : 'ยังไม่มีทางเดินเชื่อมจุดนี้ ลองเลือกอาคารอื่น'}
          </p>
        )}
      </form>
      {matches.length ? (
        <>
          <h2>{searching ? 'ผลการค้นหา' : 'สถานที่ในมหาวิทยาลัย'}</h2>
          <ul
            className={styles.results}
            data-featured={!searching}
            aria-label={searching ? 'ผลการค้นหา' : 'สถานที่ในมหาวิทยาลัย'}
          >
            {matches.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  aria-pressed={place.id === selected}
                  onClick={() => onSelect(place.id)}
                >
                  <strong>
                    {place.building?.code ??
                      (place.kind === 'gate' ? 'ประตู' : 'พื้นที่')}
                  </strong>
                  <span>
                    {mapPlaceName(place)}
                    <small>
                      {place.building ? place.building.code + ' · ' : ''}บางมด
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!searching && (
            <p className={styles.browseHint}>
              เลือกจากแผนที่หรือค้นหาชื่ออาคาร
            </p>
          )}
        </>
      ) : (
        <div className={styles.emptySearch}>
          <div role="status">
            <h2>ยังไม่พบสถานที่นี้</h2>
            <p className={styles.walkNote}>ลองรหัสอาคาร เช่น N7 หรือ S3</p>
          </div>
          <button
            className={styles.secondaryAction}
            type="button"
            onClick={() => {
              setQuery('');
              searchRef.current?.focus();
            }}
          >
            ค้นหาใหม่
          </button>
        </div>
      )}
    </section>
  );
}
