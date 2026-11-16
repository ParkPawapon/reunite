import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { migrate } from '../../packages/database/src/migrations';
import { withTransaction } from '@campus/database';
import { createServices } from '@/lib/composition';
import { createMatchingHandlers } from '@/lib/http/matching-handlers';
import { hashSessionToken } from '@/lib/security/session';
import { PgMatchingQueue } from '@/modules/matching/infrastructure/pg-matching-queue';
import {
  MatchingWorker,
  MatchingFailure,
} from '@/modules/matching/application/matching-worker';
import type {
  MatchAssessment,
  ProviderResult,
} from '@/modules/matching/domain/matching';
import { isolatedDatabase } from './database-fixture';

const fixture = isolatedDatabase(),
  pool = fixture.pool;
const queue = new PgMatchingQueue(pool);
const handlers = createMatchingHandlers(() => createServices(pool));
let cookie = '';
const assessment: MatchAssessment = {
  decision: 'possible_match',
  summary: 'รุ่นและรอยบิ่นตรงกัน โปรดตรวจสอบกับผู้แจ้ง',
  evidence: [
    {
      attribute: 'model',
      relation: 'agree',
      detail: 'รุ่นเดียวกันทั้งสองรายงาน',
    },
    {
      attribute: 'damage',
      relation: 'agree',
      detail: 'รอยบิ่นมุมขวาทั้งสองรายงาน',
    },
  ],
  missingEvidence: ['หลักฐานความเป็นเจ้าของ'],
  imageComparison: 'none',
};
const result: ProviderResult = {
  assessment,
  model: 'test-provider',
  responseId: 'test-response',
  estimatedUsdMicros: 2500,
};
const context = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});
const request = (
  method = 'GET',
  session = cookie,
  body?: Uint8Array,
  origin = 'http://localhost:3000',
  type = 'image/png',
) =>
  new Request('http://localhost:3000/api/v1/matches', {
    method,
    headers: { cookie: session, origin, 'content-type': type },
    ...(body ? { body: new Uint8Array(body) } : {}),
  });
async function report(userId = 1, type = 'LOST', status = 'OPEN') {
  const row = (
    await pool.query<{ report_id: number }>(
      `INSERT INTO item_reports(user_id,category_id,location_id,type,title,description,event_datetime,status)
    VALUES($1,1,1,$2,$3,$4,$5,$6) RETURNING report_id`,
      [
        userId,
        type,
        'ขวดน้ำรุ่นทดสอบ',
        'มีรอยบิ่นมุมขวา',
        '2026-11-16T08:00:00Z',
        status,
      ],
    )
  ).rows[0];
  if (!row) throw new Error('Missing report');
  return row.report_id;
}
async function pair() {
  const lost = await report();
  const found = await report(2, 'FOUND');
  return { lost, found };
}
async function row() {
  return (
    await pool.query('SELECT * FROM report_matches ORDER BY match_id LIMIT 1')
  ).rows[0];
}
beforeAll(async () => {
  await fixture.open();
  await migrate(pool);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.LOG_LEVEL = 'silent';
});
afterAll(() => fixture.close());
beforeEach(async () => {
  vi.stubEnv('MATCHING_ENABLED', 'false');
  vi.stubEnv('MATCHING_BUDGET_USD', '0');
  await pool.query(
    'TRUNCATE users,categories,locations RESTART IDENTITY CASCADE',
  );
  for (const id of [1, 2, 3])
    await pool.query(
      'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3)',
      [`Test ${id}`, `matching${id}@example.test`, 'not-a-login-password'],
    );
  await pool.query(
    "INSERT INTO categories(category_name) VALUES('สิ่งของทดสอบ')",
  );
  await pool.query(
    "INSERT INTO locations(location_name) VALUES('สถานที่ทดสอบ')",
  );
  const token = randomBytes(32).toString('base64url');
  cookie = `lost_found_session=${token}`;
  await pool.query(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,1,CURRENT_TIMESTAMP+INTERVAL '1 day')",
    [hashSessionToken(token)],
  );
});

it('atomically queues only open, opposite-type reports from different accounts; a rollback leaves no job', async () => {
  await report();
  await report(1, 'FOUND');
  await report(2, 'LOST');
  await report(3, 'FOUND', 'CLOSED');
  expect((await pool.query('SELECT 1 FROM report_matches')).rowCount).toBe(1);
  await expect(
    withTransaction(pool, async (db) => {
      await db.query(
        "INSERT INTO item_reports(user_id,category_id,location_id,type,title,event_datetime) VALUES(3,1,1,'FOUND','rollback',CURRENT_TIMESTAMP)",
      );
      throw new Error('rollback');
    }),
  ).rejects.toThrow('rollback');
  expect((await pool.query('SELECT 1 FROM report_matches')).rowCount).toBe(1);
});
it('serializes budget reservations across concurrent workers, and never leases a job twice', async () => {
  await report();
  for (let i = 0; i < 3; i++) await report(2, 'FOUND');
  const jobs = await Promise.all([
    queue.claim(100000, 100000),
    queue.claim(100000, 100000),
    queue.claim(100000, 100000),
  ]);
  expect(jobs.filter(Boolean)).toHaveLength(1);
  expect(
    (
      await pool.query(
        'SELECT SUM(reserved_usd_micros)::integer AS spent FROM report_matches',
      )
    ).rows[0].spent,
  ).toBe(100000);
  expect(await queue.claim(99999, 100000)).toBeNull();
});
it('paginates private results without duplicates and rejects invalid query parameters', async () => {
  await report();
  for (let i = 0; i < 22; i++) await report(2, 'FOUND');
  for (let i = 0; i < 22; i++) {
    const job = await queue.claim(3000000, 100000);
    if (!job) throw new Error('Missing page fixture job');
    await queue.complete(job, result);
  }
  const service = createServices(pool).matching;
  const first = await service.list(1);
  expect(first.items).toHaveLength(20);
  expect(first.nextCursor).not.toBeNull();
  const next = await service.list(1, first.nextCursor ?? undefined);
  expect(next.items).toHaveLength(2);
  expect(next.nextCursor).toBeNull();
  expect(
    new Set([...first.items, ...next.items].map((m) => m.matchId)).size,
  ).toBe(22);
  for (const query of ['before=-1', 'before=1&before=2', 'userId=2']) {
    const response = await handlers.list(
      new Request(`http://localhost:3000/api/v1/matches?${query}`, {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(422);
  }
});
it('stores actual provider results, notifies both participants exactly once, and hides suggestions from other accounts', async () => {
  const ids = await pair();
  const job = await queue.claim(1000000, 100000);
  if (!job) throw new Error('Missing job');
  expect(await queue.complete(job, result)).toBe(true);
  expect(await queue.complete(job, result)).toBe(false);
  expect(
    (
      await pool.query(
        "SELECT user_id FROM notifications WHERE kind='MATCH_SUGGESTED' ORDER BY user_id",
      )
    ).rows,
  ).toEqual([{ user_id: 1 }, { user_id: 2 }]);
  const services = createServices(pool);
  const first = await services.matching.list(1);
  expect(first.items[0]).toMatchObject({
    ownReportId: ids.lost,
    candidateReportId: ids.found,
  });
  expect((await services.matching.list(2)).items[0]).toMatchObject({
    ownReportId: ids.found,
    candidateReportId: ids.lost,
  });
  expect((await services.matching.list(3)).items).toEqual([]);
  expect(JSON.stringify(first.items)).not.toMatch(
    /matching1@|userId|password|phone/,
  );
  const response = await handlers.list(request());
  expect(response.status).toBe(200);
  expect((await response.json()).data.serviceStatus).toBe('disabled');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect((await handlers.list(request('GET', ''))).status).toBe(401);
});
it('invalidates an in-flight result after a real edit, preserves reserved cost, and ignores no-op updates', async () => {
  const { lost } = await pair();
  const job = await queue.claim(1000000, 100000);
  if (!job) throw new Error('Missing job');
  await pool.query('UPDATE item_reports SET title=title WHERE report_id=$1', [
    lost,
  ]);
  expect((await row()).state).toBe('processing');
  await createServices(pool).reports.update(lost, 1, {
    description: 'คนละยี่ห้อ ข้อมูลแก้ไข',
  });
  expect(await queue.complete(job, result)).toBe(false);
  expect(await row()).toMatchObject({
    state: 'queued',
    reserved_usd_micros: '100000',
    result: null,
  });
  expect((await pool.query('SELECT 1 FROM notifications')).rowCount).toBe(0);
});
it('retries transient failures at most three times and reserves every attempted call', async () => {
  await pair();
  const compare = vi.fn(async () => {
    throw new MatchingFailure('PROVIDER_RATE_LIMITED', true);
  });
  const worker = new MatchingWorker(queue, { compare }, 1000000, 100000);
  for (let i = 0; i < 3; i++) {
    await pool.query(
      "UPDATE report_matches SET available_at=CURRENT_TIMESTAMP-INTERVAL '1 second'",
    );
    await worker.runOnce();
  }
  expect(await row()).toMatchObject({
    state: 'failed',
    attempts: 3,
    reserved_usd_micros: '300000',
  });
  await worker.runOnce();
  expect(compare).toHaveBeenCalledTimes(3);
});
it('recovers expired leases with a new token and cannot publish results for closed reports', async () => {
  const { lost } = await pair();
  const first = await queue.claim(1000000, 100000);
  if (!first) throw new Error('Missing job');
  await pool.query(
    "UPDATE report_matches SET leased_until=CURRENT_TIMESTAMP-INTERVAL '1 second'",
  );
  const second = await queue.claim(1000000, 100000);
  expect(second?.leaseToken).not.toBe(first.leaseToken);
  expect(await queue.complete(first, result)).toBe(false);
  await pool.query(
    "UPDATE item_reports SET status='CLOSED' WHERE report_id=$1",
    [lost],
  );
  if (!second) throw new Error('Missing lease');
  expect(await queue.complete(second, result)).toBe(false);
  expect(await row()).toMatchObject({
    state: 'cancelled',
    reserved_usd_micros: '200000',
  });
});
it('repairs report-pair gaps left by concurrent commits and does not requeue completed revisions', async () => {
  const a = await pool.connect(),
    b = await pool.connect();
  try {
    await a.query('BEGIN');
    await b.query('BEGIN');
    await a.query(
      "INSERT INTO item_reports(user_id,category_id,location_id,type,title,event_datetime) VALUES(1,1,1,'LOST','concurrent lost',CURRENT_TIMESTAMP)",
    );
    await b.query(
      "INSERT INTO item_reports(user_id,category_id,location_id,type,title,event_datetime) VALUES(2,1,1,'FOUND','concurrent found',CURRENT_TIMESTAMP)",
    );
    await a.query('COMMIT');
    await b.query('COMMIT');
  } finally {
    a.release();
    b.release();
  }
  expect((await pool.query('SELECT 1 FROM report_matches')).rowCount).toBe(0);
  await queue.reconcile();
  expect((await pool.query('SELECT 1 FROM report_matches')).rowCount).toBe(1);
  const job = await queue.claim(1000000, 100000);
  if (!job) throw new Error('Missing job');
  await queue.complete(job, result);
  await queue.reconcile();
  expect((await row()).state).toBe('complete');
});
it('abstains on generic similarity without generating a notification (stub provider workflow)', async () => {
  await pair();
  await new MatchingWorker(
    queue,
    {
      compare: async () => ({
        ...result,
        assessment: { ...assessment, evidence: [] },
      }),
    },
    1000000,
    100000,
  ).runOnce();
  expect((await row()).result.decision).toBe('insufficient_evidence');
  expect((await createServices(pool).matching.list(1)).items).toHaveLength(0);
  expect((await pool.query('SELECT 1 FROM notifications')).rowCount).toBe(0);
});
it('uploads only owner images, strips metadata, sends stored bytes into jobs and clears stale bytes on URL edits', async () => {
  const { lost, found } = await pair();
  const image = await sharp({
    create: { width: 30, height: 20, channels: 3, background: '#ffffff' },
  })
    .png()
    .withMetadata()
    .toBuffer();
  expect(
    (await handlers.uploadImage(request('PUT', '', image), context(lost)))
      .status,
  ).toBe(401);
  expect(
    (
      await handlers.uploadImage(
        request('PUT', cookie, image, 'https://attacker.test'),
        context(lost),
      )
    ).status,
  ).toBe(403);
  expect(
    (await handlers.uploadImage(request('PUT', cookie, image), context(found)))
      .status,
  ).toBe(404);
  expect(
    (await handlers.uploadImage(request('PUT', cookie, image), context(lost)))
      .status,
  ).toBe(200);
  const view = await handlers.image(request('GET', ''), context(lost));
  expect(view.status).toBe(200);
  const meta = await sharp(Buffer.from(await view.arrayBuffer())).metadata();
  expect(meta.format).toBe('webp');
  expect(meta.exif).toBeUndefined();
  expect((await handlers.imageAccess(request(), context(lost))).status).toBe(
    200,
  );
  expect((await handlers.imageAccess(request(), context(found))).status).toBe(
    404,
  );
  const job = await queue.claim(1000000, 100000);
  expect(job?.lost.image?.byteLength).toBeGreaterThan(0);
  await createServices(pool).reports.update(lost, 1, {
    image: 'https://example.test/photo.png',
  });
  expect(
    await createServices(pool)
      .reportImages.get(lost)
      .catch(() => null),
  ).toBeNull();
  const next = await queue.claim(1000000, 100000);
  expect(next?.lost.image).toBeNull();
  expect(
    (await handlers.deleteImage(request('DELETE'), context(lost))).status,
  ).toBe(200);
});
