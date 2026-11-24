import {
  test,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
async function selectNov2026DateTime(
  page: Page,
  trigger: Locator,
  day: number,
  hour: string,
  minute: string,
) {
  await trigger.click();
  const picker = page.getByRole('dialog');
  await expect(picker).toBeVisible();
  const headerBtn = picker.getByRole('button', { name: /เลือกเดือนและปี/ });
  if (!((await headerBtn.textContent()) ?? '').includes('พฤศจิกายน 2569')) {
    await headerBtn.click();
    const yearStep = async () => {
      const text = await picker.getByText(/^พ\.ศ\. \d{4}$/).textContent();
      return Number(text?.replace(/\D/g, '') ?? '2569');
    };
    while ((await yearStep()) < 2569) {
      await picker
        .getByRole('button', { name: 'ปีถัดไป', exact: true })
        .click();
    }
    while ((await yearStep()) > 2569) {
      await picker
        .getByRole('button', { name: 'ปีก่อนหน้า', exact: true })
        .click();
    }
    await picker
      .getByRole('button', { name: 'พฤศจิกายน', exact: true })
      .click();
  }
  await picker
    .getByRole('button', { name: `${day} พฤศจิกายน 2569`, exact: true })
    .click();
  await picker
    .getByRole('textbox', { name: 'ชั่วโมง', exact: true })
    .fill(hour);
  await picker.getByRole('textbox', { name: 'นาที', exact: true }).fill(minute);
  await picker.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await expect(picker).toBeHidden();
}

async function fillForm(page: Page, title: string, withPhoto = false) {
  await page.getByLabel(/ชื่อสิ่งของ/).fill(title);
  await page.getByRole('combobox').first().click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox', { name: /สถานที่(?:หาย|พบ)/ }).click();
  await page.getByRole('option').first().click();
  await selectNov2026DateTime(
    page,
    page.getByRole('button', { name: /วันและเวลาที่(?:หาย|พบ)/ }),
    16,
    '10',
    '30',
  );
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

  const outlineBox = async (input: Locator) => {
    const outline = input.locator('xpath=..');
    await expect(outline).toBeVisible();
    const box = await outline.boundingBox();
    if (!box) throw new Error('Expected a visible field container');
    return box;
  };
  const buttonBox = async (button: Locator) => {
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    if (!box) throw new Error('Expected a visible field trigger');
    return box;
  };
  const compareSize = (
    first: Awaited<ReturnType<typeof buttonBox>>,
    second: Awaited<ReturnType<typeof buttonBox>>,
  ) => {
    expect(Math.abs(first.width - second.width)).toBeLessThan(1.5);
    expect(Math.abs(first.height - second.height)).toBeLessThan(1.5);
  };

  for (const [tab, placeLabel, dateLabel] of [
    ['ของหาย', /สถานที่หาย/, /วันและเวลาที่หาย/],
    ['ของที่พบ', /สถานที่พบ/, /วันและเวลาที่พบ/],
  ] as const) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const location = page.getByRole('combobox', { name: placeLabel });
    const desktopPlace = await outlineBox(location);
    const dateButton = page.getByRole('button', { name: dateLabel });
    const datetime = await buttonBox(dateButton);
    compareSize(desktopPlace, datetime);
    expect(Math.abs(desktopPlace.y - datetime.y)).toBeLessThan(1.5);

    await location.click();
    await page.getByRole('option').first().click();
    await expect(location).toHaveValue(/สถานที่ทดสอบ/);
    compareSize(await outlineBox(location), datetime);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobilePlace = await outlineBox(location);
    const mobileDatetime = await buttonBox(dateButton);
    compareSize(mobilePlace, mobileDatetime);
    expect(Math.abs(mobilePlace.x - mobileDatetime.x)).toBeLessThan(1.5);
    expect(mobileDatetime.y).toBeGreaterThan(
      mobilePlace.y + mobilePlace.height,
    );
  }
});

test('edits Thai Buddhist Era calendar and 24-hour time popover cleanly with zero a11y issues', async ({
  page,
}) => {
  await openForm(page);
  const trigger = page.getByRole('button', { name: /วันและเวลาที่หาย/ });
  await expect(trigger).toContainText('เลือกวันและเวลา');

  await trigger.click();
  const picker = page.getByRole('dialog');
  await expect(picker).toBeVisible();
  await expect(picker.getByText('รูปแบบ 24 ชั่วโมง')).toBeVisible();
  await expect(picker).toHaveCSS('opacity', '1');
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);

  await picker.getByRole('button', { name: 'ลดชั่วโมง', exact: true }).click();
  await picker.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(trigger).toContainText('เลือกวันและเวลา');

  await selectNov2026DateTime(page, trigger, 24, '02', '04');
  await expect(trigger).toContainText('24 พ.ย. 2569 · 02:04 น.');

  await trigger.click();
  const reopened = page.getByRole('dialog');
  await reopened.getByRole('button', { name: 'วันนี้', exact: true }).click();
  await reopened.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await expect(reopened).toBeHidden();
  await expect(trigger).toContainText(/\d{1,2} .+ 25\d{2} · \d{2}:\d{2} น\./);
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

test('prevents selecting future Bangkok dates or times and unlocks minutes in real time', async ({
  page,
}) => {
  await page.clock.install({
    time: new Date('2026-11-24T14:30:55+07:00'),
  });
  await openForm(page);

  const title = `${prefix}ทดสอบเวลาปัจจุบัน`;
  await page.getByLabel(/ชื่อสิ่งของ/).fill(title);
  await page.getByRole('combobox').first().click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox', { name: /สถานที่หาย/ }).click();
  await page.getByRole('option').first().click();

  const trigger = page.getByRole('button', { name: /วันและเวลาที่หาย/ });
  await trigger.click();
  const picker = page.getByRole('dialog');
  await expect(picker).toBeVisible();
  await expect(picker.getByText('เลือกได้ถึง 14:30 น.')).toBeVisible();

  await expect(
    picker.getByRole('button', { name: '25 พฤศจิกายน 2569', exact: true }),
  ).toBeDisabled();
  await expect(
    picker.getByRole('button', { name: '1 ธันวาคม 2569', exact: true }),
  ).toBeDisabled();
  await expect(
    picker.getByRole('button', { name: 'เดือนถัดไป', exact: true }),
  ).toBeDisabled();

  await picker.getByRole('button', { name: /เลือกเดือนและปี/ }).click();
  await expect(
    picker.getByRole('button', { name: 'ปีถัดไป', exact: true }),
  ).toBeDisabled();
  await expect(
    picker.getByRole('button', { name: 'ธันวาคม', exact: true }),
  ).toBeDisabled();
  await picker.getByRole('button', { name: 'พฤศจิกายน', exact: true }).click();

  const incHour = picker.getByRole('button', {
    name: 'เพิ่มชั่วโมง',
    exact: true,
  });
  const incMinute = picker.getByRole('button', {
    name: 'เพิ่มนาที',
    exact: true,
  });
  await expect(incHour).toBeDisabled();
  await expect(incMinute).toBeDisabled();

  const hourBox = picker.getByRole('textbox', { name: 'ชั่วโมง', exact: true });
  const minuteBox = picker.getByRole('textbox', { name: 'นาที', exact: true });
  await hourBox.fill('20');
  await expect(hourBox).toHaveValue('14');
  await minuteBox.fill('50');
  await expect(minuteBox).toHaveValue('30');

  // Switch to yesterday, select 20:50, then jump back to today and verify clamp.
  await picker
    .getByRole('button', { name: '23 พฤศจิกายน 2569', exact: true })
    .click();
  await expect(incHour).toBeEnabled();
  await hourBox.fill('20');
  await minuteBox.fill('50');
  await expect(hourBox).toHaveValue('20');
  await expect(minuteBox).toHaveValue('50');

  await picker
    .getByRole('button', { name: '24 พฤศจิกายน 2569', exact: true })
    .click();
  await expect(hourBox).toHaveValue('14');
  await expect(minuteBox).toHaveValue('30');

  // Advance clock across the minute boundary while popover stays open.
  await page.clock.fastForward(6000);
  await expect(picker.getByText('เลือกได้ถึง 14:31 น.')).toBeVisible();
  await expect(incMinute).toBeEnabled();
  await incMinute.click();
  await expect(minuteBox).toHaveValue('31');

  await picker.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(trigger).toContainText('24 พ.ย. 2569 · 14:31 น.');

  await submitLost(page).click();
  await expect(
    page.getByRole('heading', { name: 'แจ้งรายการแล้ว' }),
  ).toBeVisible();
  const rows = await reportsCreated(title);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.event_datetime.toISOString()).toBe(
    '2026-11-24T07:31:00.000Z',
  );
});
