import 'server-only';
import sharp from 'sharp';

export type ImageSimilarityLevel =
  'similar' | 'moderate' | 'different' | 'unavailable';

export type ImageSimilarity = {
  status: 'both' | 'one' | 'none';
  level: ImageSimilarityLevel;
  label: string;
  detail: string;
};

const AI_IMAGE_DEFAULT_MAX_EDGE = 512;
const AI_IMAGE_COMPACT_MAX_EDGE = 384;
const AI_IMAGE_OPTIMIZE_THRESHOLD_BYTES = 40_000;

export async function prepareMatchImageForAi(
  bytes: Uint8Array,
  totalImagesInPair = 2,
): Promise<Uint8Array> {
  const maxEdge =
    totalImagesInPair > 2
      ? AI_IMAGE_COMPACT_MAX_EDGE
      : AI_IMAGE_DEFAULT_MAX_EDGE;
  const quality = totalImagesInPair > 2 ? 65 : 70;
  try {
    const pipeline = sharp(bytes, {
      limitInputPixels: 24_000_000,
      failOn: 'warning',
    });
    const meta = await pipeline.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (
      width <= maxEdge &&
      height <= maxEdge &&
      bytes.byteLength <= AI_IMAGE_OPTIMIZE_THRESHOLD_BYTES
    ) {
      return bytes;
    }
    const resized = await pipeline
      .rotate()
      .resize(maxEdge, maxEdge, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .timeout({ seconds: 4 })
      .toBuffer();
    return resized.byteLength < bytes.byteLength ? resized : bytes;
  } catch {
    return bytes;
  }
}

type VisualFingerprint = {
  dHashBits: Uint8Array;
  rgbGrid: Uint8Array;
  meanRgb: [number, number, number];
};

async function extractVisualFingerprint(
  bytes: Uint8Array,
): Promise<VisualFingerprint | null> {
  try {
    const [grayBuffer, rgbBuffer] = await Promise.all([
      sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'warning' })
        .rotate()
        .resize(9, 8, { fit: 'fill' })
        .grayscale()
        .raw()
        .timeout({ seconds: 4 })
        .toBuffer(),
      sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'warning' })
        .rotate()
        .resize(8, 8, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .timeout({ seconds: 4 })
        .toBuffer(),
    ]);
    if (grayBuffer.length < 72 || rgbBuffer.length < 192) return null;
    const dHashBits = new Uint8Array(64);
    let bit = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = grayBuffer[y * 9 + x] ?? 0;
        const right = grayBuffer[y * 9 + x + 1] ?? 0;
        dHashBits[bit++] = left > right ? 1 : 0;
      }
    }
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let i = 0; i < 64; i++) {
      sumR += rgbBuffer[i * 3] ?? 0;
      sumG += rgbBuffer[i * 3 + 1] ?? 0;
      sumB += rgbBuffer[i * 3 + 2] ?? 0;
    }
    return {
      dHashBits,
      rgbGrid: rgbBuffer,
      meanRgb: [sumR / 64 / 255, sumG / 64 / 255, sumB / 64 / 255],
    };
  } catch {
    return null;
  }
}

function scoreFingerprints(a: VisualFingerprint, b: VisualFingerprint) {
  let matchingBits = 0;
  for (let i = 0; i < 64; i++) {
    if (a.dHashBits[i] === b.dHashBits[i]) matchingBits++;
  }
  const structureSimilarity = matchingBits / 64;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 192; i++) {
    const va = (a.rgbGrid[i] ?? 0) / 255;
    const vb = (b.rgbGrid[i] ?? 0) / 255;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const gridCosine =
    normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 1;

  const dr = a.meanRgb[0] - b.meanRgb[0];
  const dg = a.meanRgb[1] - b.meanRgb[1];
  const db = a.meanRgb[2] - b.meanRgb[2];
  const meanColorProximity =
    1 - Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);

  const colorSimilarity = 0.5 * gridCosine + 0.5 * meanColorProximity;
  return 0.45 * structureSimilarity + 0.55 * colorSimilarity;
}

function normalizeImageList(
  input: Uint8Array | (Uint8Array | null)[] | null,
): Uint8Array[] {
  if (!input) return [];
  if (input instanceof Uint8Array) return [input];
  return input.filter((value): value is Uint8Array => value !== null);
}

export async function compareMatchImagesLocally(
  lostInput: Uint8Array | (Uint8Array | null)[] | null,
  foundInput: Uint8Array | (Uint8Array | null)[] | null,
): Promise<ImageSimilarity> {
  const lostList = normalizeImageList(lostInput);
  const foundList = normalizeImageList(foundInput);
  if (!lostList.length && !foundList.length) {
    return {
      status: 'none',
      level: 'unavailable',
      label: 'ไม่มีภาพแนบ',
      detail:
        'ทั้งสองประกาศไม่ได้แนบภาพไว้ จึงใช้การเทียบจากข้อความและรายละเอียดเป็นหลัก',
    };
  }
  if (!lostList.length || !foundList.length) {
    return {
      status: 'one',
      level: 'unavailable',
      label: 'มีภาพเพียงฝั่งเดียว',
      detail:
        'มีภาพแนบเพียง 1 ฝั่ง จึงยังไม่สามารถเทียบภาพคู่กันโดยตรงได้ (ดูภาพที่แนบเทียบกับคำอธิบายอีกฝั่ง)',
    };
  }
  const [lostFps, foundFps] = await Promise.all([
    Promise.all(lostList.map((img) => extractVisualFingerprint(img))),
    Promise.all(foundList.map((img) => extractVisualFingerprint(img))),
  ]);
  const validLost = lostFps.filter(
    (fp): fp is VisualFingerprint => fp !== null,
  );
  const validFound = foundFps.filter(
    (fp): fp is VisualFingerprint => fp !== null,
  );
  if (!validLost.length || !validFound.length) {
    return {
      status: 'both',
      level: 'unavailable',
      label: 'มีภาพทั้ง 2 ฝั่ง',
      detail:
        'มีภาพแนบทั้ง 2 ฝั่ง แต่ไม่สามารถอ่านรูปแบบภาพเพื่อประเมินโทนสีอัตโนมัติได้',
    };
  }
  let score = 0;
  for (const a of validLost) {
    for (const b of validFound) {
      const pairScore = scoreFingerprints(a, b);
      if (pairScore > score) score = pairScore;
    }
  }
  const multiNote =
    lostList.length > 1 || foundList.length > 1
      ? ` (เทียบจาก ${lostList.length} ภาพของหาย กับ ${foundList.length} ภาพที่พบ)`
      : '';
  if (score >= 0.78) {
    return {
      status: 'both',
      level: 'similar',
      label: 'โทนสีและโครงภาพใกล้เคียงกัน',
      detail: `มีภาพทั้ง 2 ฝั่ง${multiNote}: โทนสีหลักและโครงสร้างภาพมีความใกล้เคียงกัน ควรตรวจจุดสังเกตเฉพาะบนภาพเพิ่มเติม`,
    };
  }
  if (score >= 0.55) {
    return {
      status: 'both',
      level: 'moderate',
      label: 'ภาพคล้ายกันบางส่วน',
      detail: `มีภาพทั้ง 2 ฝั่ง${multiNote}: โทนสีหรือองค์ประกอบบางส่วนคล้ายกัน แต่แสง พื้นหลัง หรือมุมกล้องอาจต่างกัน`,
    };
  }
  return {
    status: 'both',
    level: 'different',
    label: 'โทนสีหรือมุมภาพต่างกันมาก',
    detail: `มีภาพทั้ง 2 ฝั่ง${multiNote}: โทนสีหรือมุมภาพค่อนข้างต่างกัน อาจเป็นคนละชิ้นหรือถ่ายคนละมุม/สภาพแสง`,
  };
}
