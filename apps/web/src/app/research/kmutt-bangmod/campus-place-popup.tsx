import { useLayoutEffect, useRef } from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import { mapPlaceName, type Place } from './places';
import styles from './viewer.module.css';

export function CampusPlacePopup({
  place,
  onDismiss,
  onDirections,
}: {
  place: Place;
  onDismiss: () => void;
  onDirections?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => heading.current?.focus({ preventScroll: true }), []);

  return (
    <section
      className={styles.placePopup}
      aria-labelledby="campus-place-name"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <div className={styles.placePopupHeader}>
        <p>
          {place.building && <strong>{place.building.code}</strong>} มจธ. บางมด
        </p>
        <button type="button" aria-label="ปิดข้อมูลสถานที่" onClick={onDismiss}>
          <ShellIcon name="close" />
        </button>
      </div>
      <h2 id="campus-place-name" ref={heading} tabIndex={-1}>
        {mapPlaceName(place)}
      </h2>
      {onDirections && (
        <button
          className={styles.primaryAction}
          type="button"
          onClick={onDirections}
        >
          เส้นทาง
        </button>
      )}
    </section>
  );
}
