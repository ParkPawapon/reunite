import 'server-only';
import {
  normalizeEmail,
  type ClaimStatus,
  type ReportStatus,
  type ReportType,
} from '@campus/shared';
import { hashPassword, verifyPassword } from './password';
import { query, type Sql } from './query';

export type DevelopmentAccount = {
  name: string;
  email: string;
  password: string;
};

export type DevelopmentSeedDatasetSummary = {
  primaryUserId: number;
  peerUserId: number;
  categoryIds: number[];
  locationIds: number[];
  reportIds: number[];
  ownedClaimIds: number[];
  peerClaimIds: number[];
};

export const developmentSeedCategories = [
  'อุปกรณ์อิเล็กทรอนิกส์ (Electronics)',
  'บัตรนักศึกษาและเอกสารสำคัญ (Student ID & Documents)',
  'กระเป๋าและสิ่งของพกพา (Bags & Accessories)',
  'กุญแจและคีย์การ์ด (Keys & Access Cards)',
  'ขวดน้ำและของใช้ส่วนตัว (Personal Items)',
] as const;

export const developmentSeedLocations = [
  {
    locationName: 'อาคารการเรียนรู้พหุวิทยาการ (LX)',
    detail: 'ชั้น 1 โถงล็อบบี้และพื้นที่นั่งอ่านหนังสือ',
  },
  {
    locationName: 'สำนักหอสมุด (KMUTT Library)',
    detail: 'ชั้น 2 โซน Co-working Space',
  },
  {
    locationName: 'อาคารเรียนรวม 2 (CB2)',
    detail: 'ชั้น 3 หน้าห้องเรียนรวม',
  },
  {
    locationName: 'อาคารวิศวกรรมศาสตร์ (ตึกแดง)',
    detail: 'ชั้น 1 ลานกิจกรรมใต้อาคาร',
  },
  {
    locationName: 'โรงอาหารกลาง (พระจอมเกล้าฯ บางมด)',
    detail: 'โซนโต๊ะนั่งรับประทานอาหารฝั่งทิศเหนือ',
  },
] as const;

type SeedReportBlueprint = {
  owner: 'primary' | 'peer';
  categoryIndex: number;
  locationIndex: number;
  type: ReportType;
  title: string;
  description: string | null;
  image: string | null;
  eventDatetime: string;
  status: ReportStatus;
};

const developmentSeedReports: readonly SeedReportBlueprint[] = [
  {
    owner: 'primary',
    categoryIndex: 0,
    locationIndex: 0,
    type: 'LOST',
    title: 'ทำหูฟังไร้สาย AirPods Pro หายพร้อมเคสสีขาว',
    description:
      'ลืมไว้บนโต๊ะอ่านหนังสือชั้น 1 อาคาร LX ช่วงเช้า ตัวเคสมีรอยขีดข่วนเล็กน้อยด้านหลัง',
    image: 'https://images.example.test/reports/airpods-pro.webp',
    eventDatetime: '2026-10-15T09:30:00.000Z',
    status: 'OPEN',
  },
  {
    owner: 'peer',
    categoryIndex: 1,
    locationIndex: 1,
    type: 'FOUND',
    title: 'พบบัตรนักศึกษา มจธ. ตกอยู่หน้าทางเข้าห้องสมุด',
    description:
      'พบบัตรนักศึกษาใส่ในซองใสตกอยู่บริเวณทางเข้าชั้น 2 โซน Co-working Space สำนักหอสมุด',
    image: null,
    eventDatetime: '2026-10-16T10:15:00.000Z',
    status: 'OPEN',
  },
  {
    owner: 'primary',
    categoryIndex: 2,
    locationIndex: 2,
    type: 'LOST',
    title: 'ลืมกระเป๋าผ้าสีกรมท่าไว้ในห้องเรียนรวม CB2',
    description:
      'กระเป๋าผ้าแคนวาสสีกรมท่า ข้างในมีสมุดจดเลกเชอร์และปากกาไฮไลต์',
    image: null,
    eventDatetime: '2026-10-17T13:00:00.000Z',
    status: 'OPEN',
  },
  {
    owner: 'peer',
    categoryIndex: 3,
    locationIndex: 3,
    type: 'FOUND',
    title: 'พบพวงกุญแจหอพักพร้อมคีย์การ์ดสีฟ้า',
    description:
      'เก็บได้บริเวณม้านั่งใต้อาคารวิศวกรรมศาสตร์ (ตึกแดง) มีพวงกุญแจตุ๊กตาเป็ดสีเหลืองห้อยอยู่',
    image: 'https://images.example.test/reports/keycard-blue.webp',
    eventDatetime: '2026-10-18T14:20:00.000Z',
    status: 'OPEN',
  },
  {
    owner: 'primary',
    categoryIndex: 4,
    locationIndex: 4,
    type: 'FOUND',
    title: 'พบกระบอกน้ำเก็บความเย็นสีดำลืมไว้ที่โรงอาหารกลาง',
    description:
      'กระบอกน้ำสแตนเลสสีดำด้าน ขนาด 24 ออนซ์ ส่งคืนเจ้าของเรียบร้อยแล้ว',
    image: null,
    eventDatetime: '2026-10-19T12:10:00.000Z',
    status: 'RESOLVED',
  },
  {
    owner: 'peer',
    categoryIndex: 0,
    locationIndex: 0,
    type: 'LOST',
    title: 'ทำสายชาร์จโน้ตบุ๊ก USB-C 65W หาย',
    description:
      'หัวชาร์จสีดำสายถัก ยาว 2 เมตร ปิดรายการเนื่องจากพบในกระเป๋าตัวเองแล้ว',
    image: null,
    eventDatetime: '2026-10-20T16:45:00.000Z',
    status: 'CLOSED',
  },
];

type SeedClaimBlueprint = {
  claimant: 'primary' | 'peer';
  reportIndex: number;
  evidence: string;
  status: ClaimStatus;
  claimDate: string;
};

const developmentSeedClaims: readonly SeedClaimBlueprint[] = [
  {
    claimant: 'primary',
    reportIndex: 1,
    evidence:
      'บัตรนักศึกษารหัสลงท้าย 4 ตัวตรงกับบัตรของผม และมีสติกเกอร์ชมรมติดอยู่ที่มุมซ้ายหลังบัตรครับ',
    status: 'PENDING',
    claimDate: '2026-10-16T11:00:00.000Z',
  },
  {
    claimant: 'primary',
    reportIndex: 3,
    evidence:
      'พวงกุญแจมีป้ายชื่อหอพักและหมายเลขห้องตรงกับสัญญาเช่าหอพักของผมครับ',
    status: 'APPROVED',
    claimDate: '2026-10-18T15:20:00.000Z',
  },
  {
    claimant: 'peer',
    reportIndex: 0,
    evidence:
      'พบเคสหูฟังที่มีรอยขีดข่วนด้านหลังและหมายเลขซีเรียลตรงกับที่แจ้งไว้ครับ',
    status: 'PENDING',
    claimDate: '2026-10-19T10:15:00.000Z',
  },
];

export function assertLocalSeedTarget(env: NodeJS.ProcessEnv, args: string[]) {
  if (
    !args.includes('--development-only') ||
    (env.NODE_ENV !== undefined &&
      !['development', 'test'].includes(env.NODE_ENV))
  )
    throw new Error(
      'Local seed requires --development-only and a non-production environment',
    );
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  let database: URL;
  let application: URL;
  try {
    database = new URL(env.DATABASE_URL ?? '');
    application = new URL(env.APP_BASE_URL ?? '');
  } catch {
    throw new Error(
      'Local seed requires valid local DATABASE_URL and APP_BASE_URL',
    );
  }
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !localHosts.has(database.hostname) ||
    database.search ||
    !['http:', 'https:'].includes(application.protocol) ||
    !localHosts.has(application.hostname)
  )
    throw new Error(
      'Local seed only accepts loopback targets without database URL query overrides',
    );
}

// Intentionally private to development tooling, not exported by the runtime package.
export async function seedDevelopmentAccount(
  db: Sql,
  account: DevelopmentAccount,
) {
  const email = normalizeEmail(account.email);
  const [created] = await query<{ user_id: number }>(
    db,
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING user_id`,
    [account.name, email, await hashPassword(account.password)],
  );
  if (created) return { userId: created.user_id, created: true };
  const [existing] = await query<{ user_id: number; password_hash: string }>(
    db,
    'SELECT user_id, password_hash FROM users WHERE email = $1',
    [email],
  );
  if (
    !existing ||
    !(await verifyPassword(existing.password_hash, account.password))
  )
    throw new Error(
      'Local seed account already exists with different credentials; its data was preserved',
    );
  return { userId: existing.user_id, created: false };
}

async function ensurePeerFixtureUser(db: Sql): Promise<number> {
  const peerEmail = 'peer@reunite.test';
  const [existing] = await query<{ user_id: number }>(
    db,
    'SELECT user_id FROM users WHERE email = $1',
    [peerEmail],
  );
  if (existing) return existing.user_id;
  await query<{ user_id: number }>(
    db,
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [
      'นักศึกษาตัวอย่าง (ผู้แจ้งคนที่ 2)',
      peerEmail,
      await hashPassword('Reunite-Peer-Fixture-Only-Not-Interactive!'),
    ],
  );
  const [resolved] = await query<{ user_id: number }>(
    db,
    'SELECT user_id FROM users WHERE email = $1',
    [peerEmail],
  );
  if (!resolved) {
    throw new Error('Local seed failed to resolve peer fixture account');
  }
  return resolved.user_id;
}

export async function seedDevelopmentDataset(
  db: Sql,
  primaryUserId: number,
): Promise<DevelopmentSeedDatasetSummary> {
  const peerUserId = await ensurePeerFixtureUser(db);

  const categoryIds: number[] = [];
  for (const categoryName of developmentSeedCategories) {
    await query(
      db,
      `INSERT INTO categories (category_name) VALUES ($1)
       ON CONFLICT (category_name) DO NOTHING`,
      [categoryName],
    );
    const [row] = await query<{ category_id: number }>(
      db,
      'SELECT category_id FROM categories WHERE category_name = $1',
      [categoryName],
    );
    if (!row) {
      throw new Error(`Local seed failed to resolve category: ${categoryName}`);
    }
    categoryIds.push(row.category_id);
  }

  const locationIds: number[] = [];
  for (const loc of developmentSeedLocations) {
    const [existing] = await query<{ location_id: number }>(
      db,
      `SELECT location_id FROM locations
       WHERE location_name = $1 AND detail IS NOT DISTINCT FROM $2
       ORDER BY location_id ASC LIMIT 1`,
      [loc.locationName, loc.detail],
    );
    if (existing) {
      locationIds.push(existing.location_id);
      continue;
    }
    const [created] = await query<{ location_id: number }>(
      db,
      `INSERT INTO locations (location_name, detail)
       VALUES ($1, $2) RETURNING location_id`,
      [loc.locationName, loc.detail],
    );
    if (!created) {
      throw new Error(
        `Local seed failed to insert location: ${loc.locationName}`,
      );
    }
    locationIds.push(created.location_id);
  }

  const reportIds: number[] = [];
  for (const report of developmentSeedReports) {
    const ownerUserId = report.owner === 'primary' ? primaryUserId : peerUserId;
    const categoryId = categoryIds[report.categoryIndex];
    const locationId = locationIds[report.locationIndex];
    if (categoryId === undefined || locationId === undefined) {
      throw new Error('Local seed report blueprint references invalid index');
    }
    const [existing] = await query<{ report_id: number }>(
      db,
      `SELECT report_id FROM item_reports
       WHERE title = $1 AND event_datetime = $2::timestamptz
       ORDER BY report_id ASC LIMIT 1`,
      [report.title, report.eventDatetime],
    );
    if (existing) {
      reportIds.push(existing.report_id);
      continue;
    }
    const [created] = await query<{ report_id: number }>(
      db,
      `INSERT INTO item_reports (
         user_id, category_id, location_id, type, title, description, image, event_datetime, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9)
       RETURNING report_id`,
      [
        ownerUserId,
        categoryId,
        locationId,
        report.type,
        report.title,
        report.description,
        report.image,
        report.eventDatetime,
        report.status,
      ],
    );
    if (!created) {
      throw new Error(`Local seed failed to insert report: ${report.title}`);
    }
    reportIds.push(created.report_id);
  }

  const ownedClaimIds: number[] = [];
  const peerClaimIds: number[] = [];
  for (const claim of developmentSeedClaims) {
    const claimantUserId =
      claim.claimant === 'primary' ? primaryUserId : peerUserId;
    const reportId = reportIds[claim.reportIndex];
    if (reportId === undefined) {
      throw new Error('Local seed claim blueprint references invalid report');
    }
    const [existing] = await query<{ claim_id: number }>(
      db,
      `SELECT claim_id FROM claims
       WHERE report_id = $1 AND user_id = $2 AND evidence = $3
       ORDER BY claim_id ASC LIMIT 1`,
      [reportId, claimantUserId, claim.evidence],
    );
    const claimId =
      existing?.claim_id ??
      (
        await query<{ claim_id: number }>(
          db,
          `INSERT INTO claims (report_id, user_id, evidence, status, claim_date)
           VALUES ($1, $2, $3, $4, $5::timestamptz)
           RETURNING claim_id`,
          [
            reportId,
            claimantUserId,
            claim.evidence,
            claim.status,
            claim.claimDate,
          ],
        )
      )[0]?.claim_id;
    if (claimId === undefined) {
      throw new Error('Local seed failed to insert claim fixture');
    }
    if (claim.claimant === 'primary') {
      ownedClaimIds.push(claimId);
    } else {
      peerClaimIds.push(claimId);
    }
  }

  return {
    primaryUserId,
    peerUserId,
    categoryIds,
    locationIds,
    reportIds,
    ownedClaimIds,
    peerClaimIds,
  };
}
