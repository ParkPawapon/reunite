import { useEffect, useRef, useState } from 'react';
import type { ReportType } from '@/modules/item-reports/presentation/reports-client';
import { checkPhotos } from './photo-rules';

export type PickedPhoto = { file: File; url: string };
type ByType<T> = Record<ReportType, T>;

// Keeps one photo and one message per tab, so switching tabs loses nothing.
export function usePhotoDrafts() {
  const [photos, setPhotos] = useState<ByType<PickedPhoto | null>>({
    LOST: null,
    FOUND: null,
  });
  const [errors, setErrors] = useState<ByType<string | null>>({
    LOST: null,
    FOUND: null,
  });
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  // The browser holds a picked file in memory until its URL is revoked.
  useEffect(
    () => () => {
      for (const photo of Object.values(latest.current))
        if (photo) URL.revokeObjectURL(photo.url);
    },
    [],
  );
  const pick = (type: ReportType, files: File[]) => {
    if (!files.length) return;
    const problem = checkPhotos(files);
    setErrors((current) => ({ ...current, [type]: problem }));
    const file = files[0];
    // A rejected file never replaces the photo that is already attached.
    if (problem || !file) return;
    const previous = latest.current[type];
    if (previous) URL.revokeObjectURL(previous.url);
    const next = { file, url: URL.createObjectURL(file) };
    latest.current = { ...latest.current, [type]: next };
    setPhotos((current) => ({ ...current, [type]: next }));
  };
  const remove = (type: ReportType) => {
    const previous = latest.current[type];
    if (previous) URL.revokeObjectURL(previous.url);
    latest.current = { ...latest.current, [type]: null };
    setPhotos((current) => ({ ...current, [type]: null }));
    setErrors((current) => ({ ...current, [type]: null }));
  };
  return { photos, errors, pick, remove };
}
