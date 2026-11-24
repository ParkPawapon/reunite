import { useEffect, useRef, useState } from 'react';
import type { ReportType } from '@/modules/item-reports/presentation/reports-client';
import { checkPhotos } from './photo-rules';

export type PickedPhoto = { id: string; file: File; url: string };
type ByType<T> = Record<ReportType, T>;

// Keeps up to 3 photos and one message per tab, so switching tabs loses nothing.
export function usePhotoDrafts() {
  const [photos, setPhotos] = useState<ByType<PickedPhoto[]>>({
    LOST: [],
    FOUND: [],
  });
  const [errors, setErrors] = useState<ByType<string | null>>({
    LOST: null,
    FOUND: null,
  });
  const nextId = useRef(0);
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  // The browser holds picked files in memory until their URLs are revoked.
  useEffect(
    () => () => {
      for (const list of Object.values(latest.current))
        for (const photo of list) URL.revokeObjectURL(photo.url);
    },
    [],
  );
  const pick = (type: ReportType, files: File[]) => {
    if (!files.length) return;
    const currentList = latest.current[type];
    const problem = checkPhotos(files, currentList.length);
    setErrors((current) => ({ ...current, [type]: problem }));
    if (problem) return;
    const added = files.map((file) => ({
      id: `photo-${++nextId.current}`,
      file,
      url: URL.createObjectURL(file),
    }));
    const nextList = [...currentList, ...added];
    latest.current = { ...latest.current, [type]: nextList };
    setPhotos((current) => ({ ...current, [type]: nextList }));
  };
  const remove = (type: ReportType, photoId?: string) => {
    const currentList = latest.current[type];
    const remaining: PickedPhoto[] = [];
    for (const item of currentList) {
      if (!photoId || item.id === photoId) URL.revokeObjectURL(item.url);
      else remaining.push(item);
    }
    latest.current = { ...latest.current, [type]: remaining };
    setPhotos((current) => ({ ...current, [type]: remaining }));
    setErrors((current) => ({ ...current, [type]: null }));
  };
  return { photos, errors, pick, remove };
}
