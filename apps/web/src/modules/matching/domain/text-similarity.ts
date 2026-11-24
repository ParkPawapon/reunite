const STOP_WORDS = new Set([
  'ของหาย',
  'ของที่พบ',
  'แจ้งหาย',
  'แจ้งพบ',
  'ตามหา',
  'เก็บได้',
  'พบเจอ',
  'หล่น',
  'ตกหล่น',
  'หาย',
  'พบ',
  'เจอ',
  'สี',
  'อัน',
  'ใบ',
  'ชิ้น',
  'เครื่อง',
  'ตัว',
  'คู่',
  'เส้น',
  'ข้าง',
  'ลูก',
  'แบบ',
  'รุ่น',
  'ยี่ห้อ',
  'แถว',
  'บริเวณ',
  'ที่',
  'ใน',
  'ตรง',
  'หน้า',
  'หลัง',
  'ข้างๆ',
  'กับ',
  'และ',
  'หรือ',
  'ของ',
  'มี',
  'อยู่',
  'เป็น',
  'จาก',
  'ได้',
  'ครับ',
  'ค่ะ',
  'นะ',
  'lost',
  'found',
  'item',
  'the',
  'and',
  'for',
  'with',
  'near',
  'color',
  'missing',
]);

export type ComparableReportText = {
  title: string;
  description: string | null;
  category: string;
  location: string;
  eventDatetime: string | Date;
};

export type TextSimilarityLevel = 'high' | 'medium' | 'low';

export type TextComparisonReason = {
  attribute: 'text' | 'code' | 'category' | 'location' | 'time';
  relation: 'agree' | 'conflict' | 'neutral';
  detail: string;
};

export type TextComparison = {
  level: TextSimilarityLevel;
  label: string;
  summary: string;
  matchedKeywords: string[];
  reasons: TextComparisonReason[];
};

const wordSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('th', { granularity: 'word' })
    : null;

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .trim();
}

function segmentWords(value: string): string[] {
  const clean = normalizeText(value);
  if (!clean) return [];
  const rawTokens: string[] = [];
  if (wordSegmenter) {
    for (const part of wordSegmenter.segment(clean)) {
      if (part.isWordLike) rawTokens.push(part.segment);
    }
  } else {
    rawTokens.push(...(clean.match(/[\p{L}\p{N}]+/gu) ?? []));
  }
  const codes = clean.match(/[a-z0-9][a-z0-9._-]{1,}/g) ?? [];
  const seen = new Set<string>();
  for (const token of [...rawTokens, ...codes]) {
    const trimmed = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (trimmed.length < 2 || STOP_WORDS.has(trimmed)) continue;
    seen.add(trimmed);
  }
  return [...seen];
}

function extractModelCodes(tokens: string[]) {
  return tokens.filter(
    (token) =>
      (/^[a-z0-9._-]{2,}$/.test(token) &&
        (/[0-9]/.test(token) || token.length >= 3)) ||
      /^\d{3,}$/.test(token),
  );
}

function trigramCosine(left: string, right: string) {
  const a = normalizeText(left).replace(/\s+/g, ' ');
  const b = normalizeText(right).replace(/\s+/g, ' ');
  if (a.length < 3 || b.length < 3) {
    if (!a || !b) return 0;
    return a === b ? 1 : 0;
  }
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();
  for (let i = 0; i <= a.length - 3; i++) {
    const tri = a.slice(i, i + 3);
    mapA.set(tri, (mapA.get(tri) ?? 0) + 1);
  }
  for (let i = 0; i <= b.length - 3; i++) {
    const tri = b.slice(i, i + 3);
    mapB.set(tri, (mapB.get(tri) ?? 0) + 1);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [tri, count] of mapA) {
    normA += count * count;
    const other = mapB.get(tri);
    if (other) dot += count * other;
  }
  for (const count of mapB.values()) normB += count * count;
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function diceSimilarity(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const setB = new Set(right);
  let shared = 0;
  for (const token of left) {
    if (setB.has(token)) shared++;
  }
  return (2 * shared) / (left.length + right.length);
}

function formatTimeGap(diffHours: number) {
  const absHours = Math.abs(diffHours);
  if (absHours < 1) return 'เวลาใกล้เคียงกัน (ไม่เกิน 1 ชั่วโมง)';
  if (absHours < 24) return `ห่างกันประมาณ ${Math.round(absHours)} ชั่วโมง`;
  const days = Math.round(absHours / 24);
  return `ห่างกันประมาณ ${days} วัน`;
}

export function scoreTextPairForQueue(
  lost: ComparableReportText,
  found: ComparableReportText,
): {
  priorityScore: number;
  fastReject: boolean;
  comparison: TextComparison;
} {
  const lostCombined = [lost.title, lost.description].filter(Boolean).join(' ');
  const foundCombined = [found.title, found.description]
    .filter(Boolean)
    .join(' ');
  const lostTokens = segmentWords(lostCombined);
  const foundTokens = segmentWords(foundCombined);
  const foundSet = new Set(foundTokens);
  const matchedKeywords = lostTokens
    .filter((token) => foundSet.has(token))
    .slice(0, 8);
  const matchedCodes = extractModelCodes(matchedKeywords);

  const wordDice = diceSimilarity(lostTokens, foundTokens);
  const trigram = trigramCosine(lostCombined, foundCombined);
  const lexical =
    lostTokens.length && foundTokens.length
      ? 0.65 * wordDice + 0.35 * trigram
      : trigram;

  const sameCategory =
    normalizeText(lost.category) !== '' &&
    normalizeText(lost.category) === normalizeText(found.category);
  const lostLoc = normalizeText(lost.location);
  const foundLoc = normalizeText(found.location);
  const sameLocation = lostLoc !== '' && lostLoc === foundLoc;
  const locationOverlap = diceSimilarity(
    segmentWords(lost.location),
    segmentWords(found.location),
  );

  const lostMs = new Date(lost.eventDatetime).getTime();
  const foundMs = new Date(found.eventDatetime).getTime();
  const validTime = Number.isFinite(lostMs) && Number.isFinite(foundMs);
  const diffHours = validTime ? (foundMs - lostMs) / 3_600_000 : NaN;
  const timeConflict = Number.isFinite(diffHours) && diffHours < -24;

  const codeBonus = matchedCodes.some((c) => /\d/.test(c))
    ? 14
    : matchedCodes.length > 0
      ? 8
      : 0;
  const textPoints = Math.min(72, Math.round(lexical * 68) + codeBonus);
  const categoryPoints = sameCategory ? 15 : 0;
  const locationPoints = sameLocation ? 8 : locationOverlap > 0.25 ? 4 : 0;
  const timePoints = !Number.isFinite(diffHours)
    ? 0
    : timeConflict
      ? -12
      : Math.abs(diffHours) <= 24
        ? 5
        : Math.abs(diffHours) <= 168
          ? 3
          : 0;

  const priorityScore = Math.max(
    0,
    Math.min(100, textPoints + categoryPoints + locationPoints + timePoints),
  );

  const level: TextSimilarityLevel =
    priorityScore >= 65 || (lexical >= 0.55 && sameCategory)
      ? 'high'
      : priorityScore >= 35 || matchedKeywords.length >= 2 || lexical >= 0.28
        ? 'medium'
        : 'low';

  const label = {
    high: 'ข้อความคล้ายกันมาก',
    medium: 'ข้อความคล้ายกันปานกลาง',
    low: 'ข้อความคล้ายกันน้อย',
  }[level];

  const reasons: TextComparisonReason[] = [];
  if (matchedKeywords.length > 0) {
    reasons.push({
      attribute: 'text',
      relation: 'agree',
      detail: `พบคำสำคัญตรงกัน: ${matchedKeywords.slice(0, 6).join(', ')}`,
    });
  } else if (trigram >= 0.25) {
    reasons.push({
      attribute: 'text',
      relation: 'neutral',
      detail: 'สำนวนหรือรูปคำบางส่วนใกล้เคียงกัน แต่ไม่พบคำหลักที่ตรงกันเป๊ะ',
    });
  } else {
    reasons.push({
      attribute: 'text',
      relation: 'conflict',
      detail: 'ชื่อและรายละเอียดของทั้งสองประกาศไม่มีคำสำคัญตรงกัน',
    });
  }

  if (matchedCodes.length > 0) {
    reasons.push({
      attribute: 'code',
      relation: 'agree',
      detail: `พบรหัส/รุ่นหรือคำเฉพาะตรงกัน: ${matchedCodes.slice(0, 4).join(', ')}`,
    });
  }

  reasons.push({
    attribute: 'category',
    relation: sameCategory ? 'agree' : 'conflict',
    detail: sameCategory
      ? `หมวดหมู่ตรงกัน (${lost.category})`
      : `อยู่คนละหมวดหมู่ (${lost.category} / ${found.category})`,
  });

  if (lostLoc && foundLoc) {
    reasons.push({
      attribute: 'location',
      relation: sameLocation
        ? 'agree'
        : locationOverlap > 0.25
          ? 'neutral'
          : 'neutral',
      detail: sameLocation
        ? `ระบุสถานที่เดียวกัน (${lost.location})`
        : `คนละจุด (${lost.location} / ${found.location})`,
    });
  }

  if (Number.isFinite(diffHours)) {
    reasons.push({
      attribute: 'time',
      relation: timeConflict
        ? 'conflict'
        : Math.abs(diffHours) <= 72
          ? 'agree'
          : 'neutral',
      detail: timeConflict
        ? `พบก่อนเวลาที่แจ้งหาย (${formatTimeGap(diffHours)})`
        : formatTimeGap(diffHours),
    });
  }

  const summaryParts: string[] = [
    matchedKeywords.length > 0
      ? `พบคำสำคัญตรงกัน (${matchedKeywords.slice(0, 4).join(', ')})`
      : 'ยังไม่พบคำสำคัญเฉพาะตรงกัน',
    sameCategory ? 'หมวดหมู่ตรงกัน' : 'ต่างหมวดหมู่',
    sameLocation ? 'สถานที่เดียวกัน' : 'คนละสถานที่',
  ];
  const summary = `${label}: ${summaryParts.join(' และ')}`;

  const fastReject =
    !sameCategory &&
    matchedKeywords.length === 0 &&
    trigram < 0.14 &&
    wordDice === 0;

  return {
    priorityScore,
    fastReject,
    comparison: {
      level,
      label,
      summary,
      matchedKeywords,
      reasons,
    },
  };
}

export function analyzeMatchText(
  lost: ComparableReportText,
  found: ComparableReportText,
): TextComparison {
  return scoreTextPairForQueue(lost, found).comparison;
}
