import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type Request,
} from '@playwright/test';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { browserAccount } from './test-account';
import { isolatedServerDatabase } from './isolated-server-database';

let pool: Pool | undefined;
let prefix = '';
let photo: Buffer;
let cookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

// Give this suite its own account in the disposable schema. Other suites can
// exercise the real login throttle independently.
test.beforeAll(async ({ browser }) => {
  if (process.env.PLAYWRIGHT_BASE_URL) return;
  const email = `fe009-${randomUUID()}@example.test`;
  const fixtureDb = await isolatedServerDatabase();
  try {
    const account = await fixtureDb.query(
      `INSERT INTO users (name, email, password_hash)
       SELECT 'Report submission fixture', $2, password_hash
       FROM users WHERE email = $1`,
      [browserAccount.email, email],
    );
    expect(account.rowCount).toBe(1);
  } finally {
    await fixtureDb.end();
  }
  const context = await browser.newContext({
    baseURL: 'http://localhost:3100',
  });
  try {
    const login = await context.request.post('/api/v1/auth/login', {
      headers: { origin: 'http://localhost:3100' },
      data: { email, password: browserAccount.password },
    });
    expect(login.status()).toBe(200);
    cookies = await context.cookies();
  } finally {
    await context.close();
  }
  photo = await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .png()
    .toBuffer();
});
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Requires the managed disposable test database',
  );
  pool = await isolatedServerDatabase();
  prefix = `FE009 ${testInfo.testId} `;
  await page.context().addCookies(cookies);
});
test.afterEach(async () => {
  if (!pool) return;
  try {
    const ids = (
      await pool.query<{ report_id: number }>(
        'SELECT report_id FROM item_reports WHERE title LIKE $1',
        [`${prefix}%`],
      )
    ).rows.map((row) => row.report_id);
    await pool.query(
      'DELETE FROM report_matches WHERE lost_report_id = ANY($1) OR found_report_id = ANY($1)',
      [ids],
    );
    await pool.query('DELETE FROM item_reports WHERE report_id = ANY($1)', [
      ids,
    ]);
  } finally {
    await pool.end();
    pool = undefined;
  }
});

async function reportsCreated(title: string) {
  if (!pool) throw new Error('Test database is not open');
  const result = await pool.query<{
    report_id: number;
    type: string;
    event_datetime: Date;
  }>(
    'SELECT report_id, type, event_datetime FROM item_reports WHERE title = $1',
    [title],
  );
  return result.rows;
}
// Counts what the page really sends, so a duplicate POST cannot hide.
function watchWrites(page: Page) {
  const posts: Request[] = [];
  const puts: Request[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path === '/api/v1/item-reports')
      posts.push(request);
    if (request.method() === 'PUT' && /\/item-reports\/\d+\/image$/.test(path))
      puts.push(request);
  });
  return { posts, puts };
}
async function openForm(page: Page) {
  await page.goto('/reports/new');
  await expect(page.getByLabel(/ชื่อสิ่งของ/)).toBeVisible();
  await expect(page.getByRole('combobox').first()).toBeEnabled();
}
async function fillForm(page: Page, title: string, withPhoto = false) {
  await page.getByLabel(/ชื่อสิ่งของ/).fill(title);
  await page.getByRole('combobox').first().click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option').first().click();
  const narrow = (page.viewportSize()?.width ?? 1440) < 768;
  if (narrow) {
    await page.locator('input[type=date]').fill('2026-11-16');
    await page.locator('input[type=time]').fill('10:30');
  } else {
    await page.locator('input[type=datetime-local]').fill('2026-11-16T10:30');
  }
  if (withPhoto)
    await page.locator('input[type=file]').setInputFiles({
      name: 'umbrella.png',
      mimeType: 'image/png',
      buffer: photo,
    });
}
const submitLost = (page: Page) =>
  page.getByRole('button', { name: 'แจ้งของหาย', exact: true });

test('creates a lost report with a photo and confirms it in Thai', async ({
  page,
}) => {
  const title = `${prefix}ร่ม`;
  const writes = watchWrites(page);
  await openForm(page);
  await fillForm(page, title, true);
  await submitLost(page).click();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  await expect(
    page.getByText('16 พ.ย. 2569 · 10:30 น. · แนบรูปแล้ว'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'กลับหน้าหลัก' }),
  ).toHaveAttribute('href', '/dashboard');
  const rows = await reportsCreated(title);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.type).toBe('LOST');
  // 10:30 Thai time is 03:30 UTC.
  expect(rows[0]?.event_datetime.toISOString()).toBe(
    '2026-11-16T03:30:00.000Z',
  );
  expect(writes.posts).toHaveLength(1);
  expect(writes.puts).toHaveLength(1);
  const image = await page.request.get(
    `/api/v1/item-reports/${rows[0]?.report_id}/image`,
  );
  expect(image.status()).toBe(200);
});

test('sends one request when the submit button is pressed twice', async ({
  page,
}) => {
  const title = `${prefix}ดับเบิลคลิก`;
  const writes = watchWrites(page);
  await openForm(page);
  await fillForm(page, title);
  await submitLost(page).dblclick();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  expect(writes.posts).toHaveLength(1);
  expect(writes.puts).toHaveLength(0);
  expect(await reportsCreated(title)).toHaveLength(1);
});

test('retries only the photo after a failed upload and never posts twice', async ({
  page,
}) => {
  const title = `${prefix}รูปล้ม`;
  const writes = watchWrites(page);
  let uploads = 0;
  await page.route('**/api/v1/item-reports/*/image', async (route) => {
    uploads++;
    if (uploads === 1)
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{}',
      });
    return route.continue();
  });
  await openForm(page);
  await fillForm(page, title, true);
  await submitLost(page).click();
  await expect(
    page.getByText('แจ้งรายการแล้ว แต่แนบรูปไม่สำเร็จ'),
  ).toBeVisible();
  // The report exists, the main button cannot create another one, form data stays.
  expect(await reportsCreated(title)).toHaveLength(1);
  await expect(submitLost(page)).toBeDisabled();
  await page.getByLabel(/ชื่อสิ่งของ/).press('Enter');
  await expect(page.getByLabel(/ชื่อสิ่งของ/)).toHaveValue(title);
  expect(writes.posts).toHaveLength(1);
  await page.getByRole('button', { name: 'ลองแนบรูปอีกครั้ง' }).click();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  expect(writes.posts).toHaveLength(1);
  expect(writes.puts).toHaveLength(2);
  const urls = new Set(writes.puts.map((request) => request.url()));
  expect(urls.size).toBe(1);
  const rows = await reportsCreated(title);
  expect(rows).toHaveLength(1);
  const image = await page.request.get(
    `/api/v1/item-reports/${rows[0]?.report_id}/image`,
  );
  expect(image.status()).toBe(200);
});

test('keeps the form after a failed create and then creates exactly one report', async ({
  page,
}) => {
  const title = `${prefix}ส่งไม่ผ่าน`;
  const writes = watchWrites(page);
  let attempts = 0;
  await page.route('**/api/v1/item-reports', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{}',
      });
    return route.continue();
  });
  await openForm(page);
  await fillForm(page, title, true);
  await submitLost(page).click();
  await expect(page.getByText('ส่งรายการไม่สำเร็จ')).toBeVisible();
  await expect(page.getByLabel(/ชื่อสิ่งของ/)).toHaveValue(title);
  await expect(page.getByText('umbrella.png')).toBeVisible();
  expect(await reportsCreated(title)).toHaveLength(0);
  await submitLost(page).click();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  expect(writes.posts).toHaveLength(2);
  expect(await reportsCreated(title)).toHaveLength(1);
});

test('tells the user the result is uncertain when the connection drops', async ({
  page,
}) => {
  const title = `${prefix}เน็ตหลุด`;
  const writes = watchWrites(page);
  await page.route('**/api/v1/item-reports', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.fallback(),
  );
  await openForm(page);
  await fillForm(page, title);
  await submitLost(page).click();
  await expect(
    page.getByText('ยังไม่ทราบว่าส่งรายการสำเร็จหรือไม่'),
  ).toBeVisible();
  await expect(
    page.getByText('กรุณาตรวจสอบที่หน้าหลักก่อนส่งซ้ำ'),
  ).toBeVisible();
  await expect(page.getByLabel(/ชื่อสิ่งของ/)).toHaveValue(title);
  expect(writes.posts).toHaveLength(1);
});

test('shows errors under the fields and sends nothing when the form is incomplete', async ({
  page,
}) => {
  const writes = watchWrites(page);
  await openForm(page);
  await submitLost(page).click();
  await expect(page.getByText('กรุณากรอกชื่อสิ่งของ')).toBeVisible();
  await expect(page.getByText('กรุณาเลือกหมวดหมู่')).toBeVisible();
  await expect(page.getByText('กรุณาเลือกสถานที่หาย')).toBeVisible();
  await expect(page.getByLabel(/ชื่อสิ่งของ/)).toBeFocused();
  expect(writes.posts).toHaveLength(0);
});

test('keeps each tab separate and creates a found report from its own tab', async ({
  page,
}) => {
  const lostTitle = `${prefix}ของหายที่ยังไม่ส่ง`;
  const foundTitle = `${prefix}ของที่พบ`;
  const writes = watchWrites(page);
  await openForm(page);
  await page.getByLabel(/ชื่อสิ่งของ/).fill(lostTitle);
  await page.getByRole('tab', { name: /ของที่พบ/ }).click();
  await expect(page.getByLabel(/ชื่อสิ่งของ/)).toHaveValue('');
  await fillForm(page, foundTitle, true);
  await page.getByRole('button', { name: 'แจ้งของที่พบ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  const rows = await reportsCreated(foundTitle);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.type).toBe('FOUND');
  expect(writes.posts).toHaveLength(1);
  await page.getByRole('tab', { name: /ของหาย/ }).click();
  await expect(page.getByLabel(/ชื่อสิ่งของ/)).toHaveValue(lostTitle);
  expect(await reportsCreated(lostTitle)).toHaveLength(0);
});

test('works on a phone with separate date and time fields', async ({
  page,
}) => {
  const title = `${prefix}มือถือ`;
  await page.setViewportSize({ width: 390, height: 844 });
  await openForm(page);
  await fillForm(page, title, true);
  await submitLost(page).click();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  const rows = await reportsCreated(title);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.event_datetime.toISOString()).toBe(
    '2026-11-16T03:30:00.000Z',
  );
});
