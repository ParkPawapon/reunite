import 'server-only';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '@campus/shared';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const types = new Set(['image/jpeg', 'image/png', 'image/webp']);
export async function normalizeProfileImage(
  input: Uint8Array,
  contentType: string,
) {
  if (!types.has(contentType))
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Use JPEG, PNG or WebP');
  if (input.byteLength > MAX_AVATAR_BYTES)
    throw new AppError('PAYLOAD_TOO_LARGE', 413, 'Image exceeds 2 MiB');
  try {
    const image = sharp(input, {
      limitInputPixels: 16_000_000,
      failOn: 'warning',
      animated: true,
    });
    const metadata = await image.metadata();
    const expected = {
      'image/jpeg': 'jpeg',
      'image/png': 'png',
      'image/webp': 'webp',
    }[contentType];
    if (metadata.format !== expected || (metadata.pages ?? 1) !== 1)
      throw new Error('Unsupported image');
    // Auto-orient before stripping metadata; never retain uploaded filenames or EXIF/GPS.
    const data = await image
      .rotate()
      .resize(384, 384, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .timeout({ seconds: 5 })
      .toBuffer();
    if (data.byteLength > 131072) throw new Error('Image output too large');
    return { data, version: createHash('sha256').update(data).digest('hex') };
  } catch {
    throw new AppError(
      'INVALID_IMAGE',
      422,
      'Image could not be decoded; use a still JPEG, PNG or WebP image',
    );
  }
}
