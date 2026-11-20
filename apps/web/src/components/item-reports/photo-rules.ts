import {
  MAX_REPORT_IMAGE_BYTES,
  MAX_REPORT_IMAGE_MIB,
} from '@/modules/item-reports/domain/report-image-policy';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');
// The server decides the limit (4 MiB, below the hosting request cap); share its constant.
export const PHOTO_MAX_BYTES = MAX_REPORT_IMAGE_BYTES;
export const PHOTO_MAX_MIB = MAX_REPORT_IMAGE_MIB;

// Returns the message to show under the photo section, or null when the file is fine.
export function checkPhotos(files: File[]): string | null {
  if (files.length > 1) return 'เลือกได้ครั้งละ 1 รูปเท่านั้น';
  const file = files[0];
  if (!file) return null;
  if (!PHOTO_TYPES.includes(file.type))
    return 'ไฟล์ต้องเป็นรูป JPG, PNG หรือ WebP เท่านั้น';
  if (file.size === 0) return 'ไฟล์นี้ว่างเปล่า กรุณาเลือกรูปอื่น';
  if (file.size > PHOTO_MAX_BYTES)
    return `รูปต้องมีขนาดไม่เกิน ${PHOTO_MAX_MIB} MB`;
  return null;
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
