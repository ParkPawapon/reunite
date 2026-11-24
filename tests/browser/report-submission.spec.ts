import {
  test,
  expect,
  type BrowserContext,
  type Locator,
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
  await page.getByRole('combobox', { name: /สถานที่(?:หาย|พบ)/ }).click();
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

test('keeps location and date controls the same size on desktop and mobile', async ({
  page,
}) => {
  await openForm(page);

  const controlBox = async (input: Locator) => {
    const outline = input.locator('xpath=..').locator('fieldset');
    await expect(outline).toBeVisible();
    const box = await outline.boundingBox();
    if (!box) throw new Error('Expected a visible field outline');
    return box;
  };
  const compareSize = (
    first: Awaited<ReturnType<typeof controlBox>>,
    second: Awaited<ReturnType<typeof controlBox>>,
  ) => {
    expect(Math.abs(first.width - second.width)).toBeLessThan(1);
    expect(Math.abs(first.height - second.height)).toBeLessThan(1);
  };

  for (const [tab, label] of [
    ['ของหาย', /สถานที่หาย/],
    ['ของที่พบ', /สถานที่พบ/],
  ] as const) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const location = page.getByRole('combobox', { name: label });
    const desktopPlace = await controlBox(location);
    const datetime = await controlBox(
      page.locator('input[type=datetime-local]'),
    );
    compareSize(desktopPlace, datetime);
    expect(Math.abs(desktopPlace.y - datetime.y)).toBeLessThan(1);

    await location.click();
    await page.getByRole('option').first().click();
    await expect(location).toHaveValue(/สถานที่ทดสอบ/);
    compareSize(await controlBox(location), datetime);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobilePlace = await controlBox(location);
    const date = await controlBox(page.locator('input[type=date]'));
    const time = await controlBox(page.locator('input[type=time]'));
    compareSize(mobilePlace, date);
    compareSize(mobilePlace, time);
    expect(Math.abs(mobilePlace.x - date.x)).toBeLessThan(1);
    expect(date.y).toBeGreaterThan(mobilePlace.y + mobilePlace.height);
  }
});

test('searches all locations and scrolls beyond the first seven choices', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const lastLocation = 'สนามกีฬา (S15)';
  const locations = Array.from({ length: 11 }, (_, index) => ({
    locationId: index + 1,
    locationName: `อาคาร N${index + 1}`,
  }));
  locations.push({ locationId: 12, locationName: lastLocation });
  await page.route('**/api/v1/locations?*', (route) =>
    route.fulfill({ json: { data: locations } }),
  );

  await openForm(page);
  const place = page.getByRole('combobox', { name: /สถานที่หาย/ });
  await place.click();
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveCount(locations.length);
  expect(
    await list.evaluate((listbox) => {
      const { top, bottom } = listbox.getBoundingClientRect();
      return Array.from(listbox.children).filter((option) => {
        const row = option.getBoundingClientRect();
        return row.top < bottom && row.bottom > top;
      }).length;
    }),
  ).toBe(7);

  const last = list.getByRole('option', { name: lastLocation });
  await expect(last).not.toBeInViewport();
  await list.evaluate((listbox) => {
    listbox.scrollTop = listbox.scrollHeight;
  });
  await expect(last).toBeInViewport();

  await place.fill('ไม่มีสถานที่นี้');
  await expect(page.getByText('ไม่พบสถานที่', { exact: true })).toBeVisible();
  await place.fill('s15');
  await expect(list.getByRole('option')).toHaveCount(1);
  await expect(last).toBeVisible();
  await place.press('ArrowDown');
  await place.press('Enter');
  await expect(place).toHaveValue(lastLocation);

  const found = page.getByRole('tab', { name: /ของที่พบ/ });
  await found.click();
  await expect(page.getByRole('combobox', { name: /สถานที่พบ/ })).toHaveValue(
    '',
  );
  await page.getByRole('tab', { name: /ของหาย/ }).click();
  await expect(place).toHaveValue(lastLocation);
});

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

test('attaches multiple angles/damage photos on a new report and uploads all of them', async ({
  page,
}) => {
  const title = `${prefix}หลายมุม`;
  const writes = watchWrites(page);
  await openForm(page);
  await fillForm(page, title, false);
  await page.locator('input[type=file]').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: photo },
    {
      name: 'very-long-second-angle-damage-photo.png',
      mimeType: 'image/png',
      buffer: photo,
    },
  ]);
  await expect(page.getByText('a.png')).toBeVisible();
  await expect(
    page.getByText('very-long-second-angle-damage-photo.png'),
  ).toBeVisible();
  const listItems = page
    .getByRole('list', { name: 'รูปสิ่งของที่แนบ' })
    .locator('li');
  const [row1Box, row2Box, del1Box, del2Box] = await Promise.all([
    listItems.nth(0).boundingBox(),
    listItems.nth(1).boundingBox(),
    page.getByRole('button', { name: 'ลบรูปที่ 1' }).boundingBox(),
    page.getByRole('button', { name: 'ลบรูปที่ 2' }).boundingBox(),
  ]);
  if (!row1Box || !row2Box || !del1Box || !del2Box) {
    throw new Error(
      'Expected photo rows and delete buttons to have bounding boxes',
    );
  }
  const del1Right = del1Box.x + del1Box.width;
  const del2Right = del2Box.x + del2Box.width;
  expect(Math.abs(del1Right - del2Right)).toBeLessThanOrEqual(1);
  expect(row1Box.x + row1Box.width - del1Right).toBeLessThan(24);
  expect(row2Box.x + row2Box.width - del2Right).toBeLessThan(24);
  await submitLost(page).click();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  await expect(page.getByText(/แนบ 2 รูปแล้ว/)).toBeVisible();
  const rows = await reportsCreated(title);
  expect(rows).toHaveLength(1);
  expect(writes.posts).toHaveLength(1);
  expect(writes.puts).toHaveLength(2);
  const reportId = rows[0]?.report_id;
  expect(
    (await page.request.get(`/api/v1/item-reports/${reportId}/image`)).status(),
  ).toBe(200);
  expect(
    (
      await page.request.get(`/api/v1/item-reports/${reportId}/image?slot=2`)
    ).status(),
  ).toBe(200);
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

test('keeps the title field disabled during mobile loading and submits its value once ready', async ({
  page,
}) => {
  const title = `${prefix}มือถือ`;
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseCatalog = () => {};
  const catalog = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  await page.route('**/api/v1/categories?*', async (route) => {
    await catalog;
    await route.continue();
  });
  const titleInput = page.getByLabel(/ชื่อสิ่งของ/);
  try {
    await page.goto('/reports/new', { waitUntil: 'domcontentloaded' });
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toBeDisabled();
  } finally {
    releaseCatalog();
  }
  await expect(titleInput).toBeEditable();
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
