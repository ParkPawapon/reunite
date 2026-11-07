import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  normalizeProfileImage,
  MAX_AVATAR_BYTES,
} from '@/modules/users/infrastructure/profile-image';
import { profileSchema } from '@/modules/users/presentation/profile-schema';

describe('profile image decoding and normalization', () => {
  it('resizes, strips metadata and produces bounded WebP with a content digest', async () => {
    const original = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#FFC72C' },
    })
      .png()
      .withMetadata()
      .toBuffer();
    const result = await normalizeProfileImage(original, 'image/png');
    const meta = await sharp(result.data).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 384, height: 384 });
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(result.data.byteLength).toBeLessThanOrEqual(131072);
    expect(result.version).toMatch(/^[0-9a-f]{64}$/);
    expect((await normalizeProfileImage(original, 'image/png')).version).toBe(
      result.version,
    );
  });
  it('rejects MIME spoofing, scripts, corruption and oversized encoded bodies', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#FFFFFF' },
    })
      .png()
      .toBuffer();
    await expect(
      normalizeProfileImage(png, 'image/jpeg'),
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE', status: 422 });
    await expect(
      normalizeProfileImage(Buffer.from('<svg/>'), 'image/svg+xml'),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      normalizeProfileImage(Buffer.from('not a PNG'), 'image/png'),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      normalizeProfileImage(new Uint8Array(MAX_AVATAR_BYTES + 1), 'image/png'),
    ).rejects.toMatchObject({ status: 413 });
  });
  it('rejects decompression-size abuse before rendering', async () => {
    const huge = await sharp({
      create: { width: 5000, height: 4000, channels: 3, background: '#FFFFFF' },
    })
      .png()
      .toBuffer();
    expect(huge.byteLength).toBeLessThan(MAX_AVATAR_BYTES);
    await expect(
      normalizeProfileImage(huge, 'image/png'),
    ).rejects.toMatchObject({ status: 422 });
  });
});
it('normalizes optional student fields and rejects ownership injection', () => {
  const input = {
    firstName: ' สมชาย ',
    lastName: ' ใจดี ',
    email: ' Person@EXAMPLE.test ',
    studentId: '',
    faculty: '',
    department: null,
    major: '',
    phone: '',
  };
  expect(profileSchema.parse(input)).toMatchObject({
    firstName: 'สมชาย',
    email: 'person@example.test',
    studentId: null,
    phone: null,
  });
  expect(profileSchema.safeParse({ ...input, userId: 8 }).success).toBe(false);
  expect(
    profileSchema.safeParse({ ...input, firstName: '\u00a0\t' }).success,
  ).toBe(false);
  expect(
    profileSchema.safeParse({ ...input, studentId: '123abc' }).success,
  ).toBe(false);
});
