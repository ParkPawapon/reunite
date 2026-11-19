import 'server-only';
import sharp from 'sharp';
import { AppError } from '@campus/shared';
import {
  MAX_REPORT_IMAGE_BYTES,
  MAX_REPORT_IMAGE_MIB,
} from '../domain/report-image-policy';
export async function normalizeReportImage(
  input: Uint8Array,
  contentType: string,
) {
  const expected = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
  }[contentType];
  if (!expected)
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Use JPEG, PNG or WebP');
  if (input.byteLength > MAX_REPORT_IMAGE_BYTES)
    throw new AppError(
      'PAYLOAD_TOO_LARGE',
      413,
      `Image exceeds ${MAX_REPORT_IMAGE_MIB} MiB`,
    );
  try {
    const image = sharp(input, {
      limitInputPixels: 24_000_000,
      failOn: 'warning',
      animated: true,
    });
    const meta = await image.metadata();
    if (meta.format !== expected || (meta.pages ?? 1) !== 1)
      throw new Error('Invalid image');
    const data = await image
      .rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .timeout({ seconds: 5 })
      .toBuffer();
    if (data.byteLength > 1048576) throw new Error('Output too large');
    return data;
  } catch {
    throw new AppError(
      'INVALID_IMAGE',
      422,
      'Use a valid still JPEG, PNG or WebP image',
    );
  }
}
