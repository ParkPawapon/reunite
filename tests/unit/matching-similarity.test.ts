import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  analyzeMatchText,
  scoreTextPairForQueue,
} from '@/modules/matching/domain/text-similarity';
import {
  compareMatchImagesLocally,
  prepareMatchImageForAi,
} from '@/modules/matching/infrastructure/image-comparison';

describe('zero-token text similarity and pre-filtering', () => {
  it('detects high Thai/English text similarity and matched model keywords', () => {
    const result = scoreTextPairForQueue(
      {
        title: 'กระเป๋าสตางค์หนังสีดำ',
        description: 'ทำหล่นแถวโรงอาหาร รุ่น Bellroy มีบัตรด้านใน',
        category: 'กระเป๋า',
        location: 'โรงอาหารกลาง',
        eventDatetime: '2026-11-24T08:00:00Z',
      },
      {
        title: 'พบกระเป๋าสตางค์สีดำ',
        description: 'เก็บได้ใกล้โรงอาหาร ยี่ห้อ Bellroy',
        category: 'กระเป๋า',
        location: 'โรงอาหารกลาง',
        eventDatetime: '2026-11-24T09:30:00Z',
      },
    );
    expect(result.fastReject).toBe(false);
    expect(result.comparison.level).toBe('high');
    expect(result.comparison.matchedKeywords).toEqual(
      expect.arrayContaining(['bellroy']),
    );
    expect(result.comparison.summary).toContain('ข้อความคล้ายกันมาก');
  });

  it('fast-rejects unrelated cross-category items without shared terms, while keeping cross-category shared terms', () => {
    const unrelated = scoreTextPairForQueue(
      {
        title: 'iPhone 15 Pro สีไทเทเนียม',
        description: 'หน้าจอมีฟิล์มด้าน ใส่เคสใส',
        category: 'อิเล็กทรอนิกส์',
        location: 'อาคาร LX',
        eventDatetime: '2026-11-24T08:00:00Z',
      },
      {
        title: 'เสื้อคลุมกันหนาวผ้าฝ้ายสีเขียว',
        description: 'ไซส์ L แขวนลืมไว้ในห้องเรียน',
        category: 'เครื่องแต่งกาย',
        location: 'ตึกเรียนรวม',
        eventDatetime: '2026-11-24T09:00:00Z',
      },
    );
    expect(unrelated.fastReject).toBe(true);
    expect(unrelated.comparison.level).toBe('low');

    const miscategorized = scoreTextPairForQueue(
      {
        title: 'สายชาร์จ MacBook USB-C สีขาว',
        description: null,
        category: 'อุปกรณ์เสริม',
        location: 'หอสมุด',
        eventDatetime: '2026-11-24T08:00:00Z',
      },
      {
        title: 'เก็บได้สายชาร์จ MacBook 67W',
        description: null,
        category: 'อิเล็กทรอนิกส์',
        location: 'หอสมุด',
        eventDatetime: '2026-11-24T10:00:00Z',
      },
    );
    expect(miscategorized.fastReject).toBe(false);
    expect(miscategorized.comparison.matchedKeywords).toContain('macbook');
  });

  it('prioritizes plausible text matches above non-overlapping same-category pairs', () => {
    const strong = scoreTextPairForQueue(
      {
        title: 'หูฟัง Sony WH-1000XM5 สีดำ',
        description: 'มีสติกเกอร์ที่ข้างซ้าย',
        category: 'อิเล็กทรอนิกส์',
        location: 'หอสมุด',
        eventDatetime: '2026-11-24T08:00:00Z',
      },
      {
        title: 'พบหูฟัง Sony WH-1000XM5 สีดำ',
        description: 'มีสติกเกอร์ที่หูฟังซ้าย',
        category: 'อิเล็กทรอนิกส์',
        location: 'หอสมุด',
        eventDatetime: '2026-11-24T08:30:00Z',
      },
    );
    const weak = analyzeMatchText(
      {
        title: 'หูฟัง Sony WH-1000XM5 สีดำ',
        description: null,
        category: 'อิเล็กทรอนิกส์',
        location: 'หอสมุด',
        eventDatetime: '2026-11-24T08:00:00Z',
      },
      {
        title: 'เมาส์ไร้สาย Logitech',
        description: null,
        category: 'อิเล็กทรอนิกส์',
        location: 'อาคาร S11',
        eventDatetime: '2026-11-20T08:00:00Z',
      },
    );
    expect(strong.comparison.level).toBe('high');
    expect(weak.level).toBe('low');
  });
});

describe('token-saving AI image resizing and local visual check', () => {
  it('downscales large photos inside 512px for AI while passing non-image test buffers safely', async () => {
    const large = await sharp({
      create: { width: 1024, height: 768, channels: 3, background: '#fa4616' },
    })
      .png()
      .toBuffer();
    const optimized = await prepareMatchImageForAi(large);
    const meta = await sharp(optimized).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);

    const dummy = Uint8Array.of(1, 2, 3);
    expect(await prepareMatchImageForAi(dummy)).toBe(dummy);
  });

  it('compares attached photos locally by visual similarity and reports single/missing cases', async () => {
    const orange = await sharp({
      create: { width: 256, height: 256, channels: 3, background: '#fa4616' },
    })
      .webp()
      .toBuffer();
    const blue = await sharp({
      create: { width: 256, height: 256, channels: 3, background: '#1d4ed8' },
    })
      .webp()
      .toBuffer();

    const similar = await compareMatchImagesLocally(orange, orange);
    expect(similar).toMatchObject({ status: 'both', level: 'similar' });

    const different = await compareMatchImagesLocally(orange, blue);
    expect(different.status).toBe('both');
    expect(['moderate', 'different']).toContain(different.level);

    expect(await compareMatchImagesLocally(orange, null)).toMatchObject({
      status: 'one',
      level: 'unavailable',
    });
    expect(await compareMatchImagesLocally(null, null)).toMatchObject({
      status: 'none',
      level: 'unavailable',
    });
  });
});
