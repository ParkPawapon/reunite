import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  migrate,
  readMigrations,
} from '../../packages/database/src/migrations';
import { createServices } from '@/lib/composition';
import { createHandlers } from '@/lib/http/handlers';
import { createMatchingHandlers } from '@/lib/http/matching-handlers';
import { hashSessionToken } from '@/lib/security/session';
import { isolatedDatabase } from './database-fixture';

const fixture = isolatedDatabase();
const { pool } = fixture;
const resolve = () => createServices(pool);
const api = createHandlers({ services: resolve, ping: async () => {} });
const matching = createMatchingHandlers(resolve);
const origin = 'http://localhost:3000';
const hidden = { preferences: null, email: null, phone: null };
let owner: string;
let claimant: string;
let other: string;

function request(path: string, cookie?: string, method = 'GET', data?: object) {
  return new Request(`${origin}/api/v1/${path}`, {
    method,
    headers: {
      origin,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}

const context = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});
const contact = (id: number, cookie?: string, matchId?: number) =>
  api.getReportContact(
    request(
      `item-reports/${id}/contact${matchId ? `?matchId=${matchId}` : ''}`,
      cookie,
    ),
    context(id),
  );
const preferences = (
  id: number,
  cookie: string,
  shareEmail: boolean,
  sharePhone: boolean,
) =>
  api.putReportContact(
    request(`item-reports/${id}/contact`, cookie, 'PUT', {
      shareEmail,
      sharePhone,
    }),
    context(id),
  );
const submit = (reportId: number, cookie: string) =>
  api.createClaim(
    request('claims', cookie, 'POST', {
      reportId,
      evidence: 'Small red mark underneath the handle',
    }),
  );
const status = (reportId: number, cookie: string) =>
  matching.reportStatus(
    request(`item-reports/${reportId}/matching`, cookie),
    context(reportId),
  );
async function session(userId: number) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 day')",
    [hashSessionToken(token), userId],
  );
  return `lost_found_session=${token}`;
}

beforeAll(async () => {
  process.env.APP_BASE_URL = origin;
  process.env.LOG_LEVEL = 'silent';
  await fixture.open();
  await migrate(pool, (await readMigrations()).slice(0, -1));
  await pool.query(`
    INSERT INTO users(name,email,password_hash,phone)
    VALUES ('Finder','finder@example.test','unused-fixture','0800000001'),
           ('Claimant','claimant@example.test','unused-fixture','0800000002'),
           ('Other','other@example.test','unused-fixture',NULL);
    INSERT INTO categories(category_name) VALUES ('Accessories');
    INSERT INTO locations(location_name) VALUES ('N7');
    INSERT INTO item_reports(user_id,category_id,location_id,type,title,event_datetime,status)
    VALUES (1,1,1,'FOUND','Bag',now(),'OPEN'),
           (2,1,1,'LOST','Bag',now(),'OPEN'),
           (1,1,1,'FOUND','Wallet',now(),'CLOSED'),
           (1,1,1,'FOUND','Legacy bag',now(),'CLOSED');
    INSERT INTO claims(report_id,user_id,evidence,claim_date)
    VALUES (4,2,'First legacy evidence',now()-interval '1 minute'),
           (4,2,'Second legacy evidence',now());
  `);
  expect(await migrate(pool)).toEqual(['0015']);
  [owner, claimant, other] = await Promise.all([
    session(1),
    session(2),
    session(3),
  ]);
});
afterAll(() => fixture.close());

it('keeps the oldest pending record and retains duplicate evidence during migration', async () => {
  const { rows } = await pool.query(
    'SELECT evidence,status FROM claims WHERE report_id=4 ORDER BY claim_id',
  );
  expect(rows).toEqual([
    { evidence: 'First legacy evidence', status: 'PENDING' },
    { evidence: 'Second legacy evidence', status: 'REJECTED' },
  ]);
});

it('restricts eligible reports and atomically delivers one new alert for simultaneous claims', async () => {
  const invalid = await Promise.all([
    submit(1, owner),
    submit(2, owner),
    submit(3, claimant),
  ]);
  expect(invalid.map((response) => response.status)).toEqual([422, 422, 422]);
  const results = await Promise.all([submit(1, claimant), submit(1, claimant)]);
  expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
  const { rows } = await pool.query(
    'SELECT user_id,kind,report_id FROM notifications WHERE report_id=1',
  );
  expect(rows).toEqual([{ user_id: 1, kind: 'CLAIM_SUBMITTED', report_id: 1 }]);
});

it('reveals only opted-in contact details after approval and revokes visibility', async () => {
  expect((await contact(1)).status).toBe(401);
  expect((await preferences(1, other, true, true)).status).toBe(404);
  expect((await preferences(1, owner, true, false)).status).toBe(200);
  const pending = await contact(1, claimant);
  expect(pending.headers.get('cache-control')).toBe('no-store');
  expect(await pending.json()).toEqual({ data: hidden });
  const {
    rows: [claim],
  } = await pool.query<{ claim_id: number }>(
    "SELECT claim_id FROM claims WHERE report_id=1 AND user_id=2 AND status='PENDING'",
  );
  if (!claim) throw new Error('Missing pending claim fixture');
  const review = (cookie: string) =>
    api.patchClaimStatus(
      request(`claims/${claim.claim_id}/status`, cookie, 'PATCH', {
        status: 'APPROVED',
      }),
      context(claim.claim_id),
    );
  expect((await review(other)).status).toBe(404);
  expect((await review(owner)).status).toBe(200);
  expect((await review(owner)).status).toBe(404);
  const publicReport = await api.getReport(
    request('item-reports/1', other),
    context(1),
  );
  const publicJson = JSON.stringify(await publicReport.json());
  expect(publicJson).not.toContain('finder@example.test');
  expect(publicJson).not.toContain('0800000001');
  expect(await (await contact(1, claimant)).json()).toEqual({
    data: { ...hidden, email: 'finder@example.test' },
  });
  expect(await (await contact(1, other)).json()).toEqual({ data: hidden });
  expect((await preferences(1, owner, false, true)).status).toBe(200);
  expect(await (await contact(1, claimant)).json()).toEqual({
    data: { ...hidden, phone: '0800000001' },
  });
  expect((await preferences(1, owner, false, false)).status).toBe(200);
  expect(await (await contact(1, claimant)).json()).toEqual({ data: hidden });
  const result = await pool.query(
    "SELECT user_id,kind,report_id FROM notifications WHERE kind='CLAIM_APPROVED'",
  );
  expect(result.rows).toEqual([
    { user_id: 2, kind: 'CLAIM_APPROVED', report_id: 1 },
  ]);
});

it('scopes matching progress to owners and requires current published matches with opt-in on both sides', async () => {
  expect((await status(2, owner)).status).toBe(404);
  expect(await (await status(2, claimant)).json()).toMatchObject({
    data: {
      open: true,
      pendingCount: 1,
      failedCount: 0,
      checkedCount: 0,
      latestMatchId: null,
    },
  });
  const {
    rows: [match],
  } = await pool.query<{ match_id: number }>(
    `UPDATE report_matches SET state='failed'
     WHERE lost_report_id=2 AND found_report_id=1 RETURNING match_id`,
  );
  if (!match) throw new Error('Missing matching fixture');
  expect(await (await status(2, claimant)).json()).toMatchObject({
    data: { pendingCount: 0, failedCount: 1 },
  });
  await pool.query(
    `UPDATE report_matches SET state='complete', notified=true,
    result='{"decision":"possible_match"}', completed_at=NOW() WHERE match_id=$1`,
    [match.match_id],
  );
  expect(await (await status(2, claimant)).json()).toMatchObject({
    data: { failedCount: 0, checkedCount: 1, latestMatchId: match.match_id },
  });
  expect((await preferences(1, owner, true, false)).status).toBe(200);
  expect(await (await contact(1, claimant, match.match_id)).json()).toEqual({
    data: hidden,
  });
  expect((await preferences(2, claimant, false, true)).status).toBe(200);
  expect(await (await contact(1, claimant, match.match_id)).json()).toEqual({
    data: { ...hidden, email: 'finder@example.test' },
  });
  expect(await (await contact(2, owner, match.match_id)).json()).toEqual({
    data: { ...hidden, phone: '0800000002' },
  });
  expect(await (await contact(1, other, match.match_id)).json()).toEqual({
    data: hidden,
  });
  expect(await (await contact(1, claimant, 2147483647)).json()).toEqual({
    data: hidden,
  });
  await pool.query(
    "UPDATE item_reports SET title='Bag with updated details' WHERE report_id=2",
  );
  expect(await (await contact(1, claimant, match.match_id)).json()).toEqual({
    data: hidden,
  });
  await pool.query("UPDATE item_reports SET status='CLOSED' WHERE report_id=1");
  expect(await (await status(1, owner)).json()).toMatchObject({
    data: {
      open: false,
      pendingCount: 0,
      checkedCount: 0,
      latestMatchId: null,
    },
  });
  expect(await (await contact(1, claimant)).json()).toEqual({ data: hidden });
});
