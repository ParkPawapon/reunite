// Leave room below the 4.5 MB Vercel Functions request limit.
export const MAX_REPORT_IMAGE_MIB = 4;
export const MAX_REPORT_IMAGE_BYTES = MAX_REPORT_IMAGE_MIB * 1024 * 1024;
export const MAX_REPORT_IMAGES = 3;

export function reportImageSlotHref(reportId: number, slot = 1) {
  return slot <= 1
    ? `/api/v1/item-reports/${reportId}/image`
    : `/api/v1/item-reports/${reportId}/image?slot=${slot}`;
}

export function reportImageHrefs(
  reportId: number,
  image: string | null,
  imageCount = 0,
): string[] {
  const base = `/api/v1/item-reports/${reportId}/image`;
  if (image !== base) return [];
  const total = Math.max(1, Math.min(MAX_REPORT_IMAGES, imageCount || 1));
  return Array.from({ length: total }, (_, index) =>
    reportImageSlotHref(reportId, index + 1),
  );
}
