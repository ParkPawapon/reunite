import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { Pool } from 'pg';
import { browserAccount } from './test-account';
import { isolatedServerDatabase } from './isolated-server-database';

let pool: Pool | undefined;
let reportId: number;
let categoryId: number;
let locationId: number;
const title = 'อะแดปเตอร์ USB-C สีขาว 30W';
const description =
  'หัวชาร์จทรงสี่เหลี่ยมสีขาวพร้อมสายยาวหนึ่งเมตร ลืมไว้ใกล้ปลั๊กไฟ (ข้อมูลสมมติสำหรับทดสอบระบบ)';
const artifacts =
  process.env.UI_ARTIFACT_DIR ?? path.join(tmpdir(), 'reunite-item-modal');
const reportPath = () => `/api/v1/item-reports/${reportId}`;

test.beforeEach(async ({ page }) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Requires the managed disposable test database',
  );
  pool = await isolatedServerDatabase();
  const login = await page.request.post('/api/v1/auth/login', {
    headers: { origin: 'http://localhost:3100' },
    data: { email: browserAccount.email, password: browserAccount.password },
  });
  expect(login.status()).toBe(200);
  categoryId =
    (
      await pool.query<{ category_id: number }>(
        'INSERT INTO categories(category_name) VALUES($1) RETURNING category_id',
        ['อุปกรณ์อิเล็กทรอนิกส์ (Electronics)'],
      )
    ).rows[0]?.category_id ?? 0;
  locationId =
    (
      await pool.query<{ location_id: number }>(
        'INSERT INTO locations(location_name) VALUES($1) RETURNING location_id',
        ['อาคารการเรียนรู้พหุวิทยาการ (LX)'],
      )
    ).rows[0]?.location_id ?? 0;
  const created = await page.request.post('/api/v1/item-reports', {
    headers: { origin: 'http://localhost:3100' },
    data: {
      categoryId,
      locationId,
      type: 'LOST',
      title,
      description,
      eventDatetime: '2026-11-15T10:00:00+07:00',
    },
  });
  expect(created.status()).toBe(201);
  const json: { data: { reportId: number } } = await created.json();
  reportId = json.data.reportId;
  await page.goto('/dashboard');
  await expect(
    page.getByRole('button', { name: title, exact: true }),
  ).toBeVisible();
});
test.afterEach(async () => {
  if (!pool) return;
  try {
    await pool.query(
      'DELETE FROM report_matches WHERE lost_report_id=$1 OR found_report_id=$1',
      [reportId],
    );
    await pool.query('DELETE FROM item_reports WHERE report_id=$1', [reportId]);
    await pool.query('DELETE FROM categories WHERE category_id=$1', [
      categoryId,
    ]);
    await pool.query('DELETE FROM locations WHERE location_id=$1', [
      locationId,
    ]);
  } finally {
    await pool.end();
    pool = undefined;
  }
});
async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getTiming().iterations))
        .map((a) => a.finished.catch(() => {})),
    );
  });
}

test('keeps the modal readable and keyboard-contained on desktop, mobile, zoom and long content', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  const trigger = page.getByRole('button', { name: title, exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const heading = dialog.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeFocused();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByText('สถานที่หาย', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('รูปช่วยให้จำง่าย', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveCount(0);
  await settle(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await mkdir(artifacts, { recursive: true });
  const desktop = path.join(artifacts, 'desktop.png');
  await page.screenshot({ path: desktop });
  await testInfo.attach('Item detail desktop', {
    path: desktop,
    contentType: 'image/png',
  });
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await expect(heading).toBeFocused();
  await settle(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  const mobile = path.join(artifacts, 'mobile.png');
  await page.screenshot({ path: mobile });
  await testInfo.attach('Item detail mobile', {
    path: mobile,
    contentType: 'image/png',
  });
  await dialog
    .getByRole('button', { name: 'กลับไปดูรายการ', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  if (!pool) throw new Error('Missing isolated fixture');
  const longTitle = 'รายละเอียดสิ่งของและลักษณะที่สังเกตได้ '
    .repeat(7)
    .slice(0, 255);
  const longDescription = 'ข้อความทดสอบรายละเอียดสิ่งของที่ยาวมาก\n'
    .repeat(180)
    .slice(0, 10000);
  await pool.query(
    'UPDATE item_reports SET title=$2,description=$3 WHERE report_id=$1',
    [reportId, longTitle, longDescription],
  );
  await page.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: longTitle, exact: true }).click();
  await expect(
    dialog.getByRole('heading', { name: longTitle, exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'ปิดรายละเอียด', exact: true }),
  ).toBeInViewport();
  await expect(
    dialog.getByRole('button', { name: 'กลับไปดูรายการ', exact: true }),
  ).toBeInViewport();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const body = dialog.getByRole('region', {
    name: 'รายละเอียดรายการ',
    exact: true,
  });
  expect(
    await body.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await dialog.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 640, height: 600 });
  await page.getByRole('button', { name: longTitle, exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'ปิดรายละเอียด', exact: true }),
  ).toBeInViewport();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('shows real detail loading and recovers from server failure or a removed report', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${reportPath()}`, async (route) => {
    await gate;
    await route.continue();
  });
  const trigger = page.getByRole('button', { name: title, exact: true });
  try {
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('status', { name: 'กำลังโหลดรายละเอียด', exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'แนบรูปสิ่งของ', exact: true }),
    ).toHaveCount(0);
    release();
    await expect(dialog.getByText(description, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  } finally {
    release();
    await page.unroute(`**${reportPath()}`);
  }
  let fail = true;
  await page.route(`**${reportPath()}`, (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: { message: 'private SQL detail' } },
        })
      : route.continue(),
  );
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText(
    'เปิดรายละเอียดไม่สำเร็จ',
  );
  await expect(dialog).not.toContainText('private SQL detail');
  fail = false;
  await dialog
    .getByRole('button', { name: 'ลองอีกครั้ง', exact: true })
    .click();
  await expect(dialog.getByText(description, { exact: true })).toBeVisible();
  await dialog
    .getByRole('button', { name: 'ปิดรายละเอียด', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.unroute(`**${reportPath()}`);
  if (!pool) throw new Error('Missing isolated fixture');
  await pool.query('DELETE FROM item_reports WHERE report_id=$1', [reportId]);
  await trigger.click();
  await expect(dialog.getByRole('alert')).toContainText('ไม่พบรายการนี้แล้ว');
  await expect(
    dialog.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole('button', { name: 'กลับไปดูรายการ', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
});

test('keeps photo upload errors actionable, renders the full item photo and retries image decoding', async ({
  page,
}, testInfo) => {
  await page.getByRole('button', { name: title, exact: true }).click();
  const dialog = page.getByRole('dialog');
  const picker = dialog.getByLabel('เลือกรูปสิ่งของ');
  await expect(
    dialog.getByRole('button', { name: 'แนบรูปสิ่งของ', exact: true }),
  ).toBeVisible();
  await picker.setInputFiles({
    name: 'wrong.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(dialog.getByRole('alert')).toContainText(
    'ใช้ JPG, PNG หรือ WebP',
  );
  const buffer = await sharp({
    create: { width: 900, height: 400, channels: 3, background: '#e8edf2' },
  })
    .png()
    .toBuffer();
  const file = { name: 'item-test.png', mimeType: 'image/png', buffer };
  let rejectUpload = true;
  let rejectImage = true;
  await page.route(`**${reportPath()}/image`, (route) => {
    if (route.request().method() === 'PUT' && rejectUpload)
      return route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE' } },
      });
    if (route.request().method() === 'GET' && rejectImage)
      return route.fulfill({ status: 503 });
    return route.continue();
  });
  await picker.setInputFiles(file);
  await expect(dialog.getByRole('alert')).toContainText('บันทึกรูปไม่สำเร็จ');
  rejectUpload = false;
  await picker.setInputFiles(file);
  await expect(
    dialog.getByText('เปิดรูปไม่สำเร็จ', { exact: true }),
  ).toBeVisible();
  rejectImage = false;
  await dialog
    .getByRole('button', { name: 'ลองโหลดรูปอีกครั้ง', exact: true })
    .click();
  const image = dialog.getByRole('img', { name: `รูป ${title}`, exact: true });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('data-loaded', 'true');
  expect(
    await image.evaluate((element) => getComputedStyle(element).objectFit),
  ).toBe('contain');
  await expect(
    dialog.getByRole('button', { name: 'เปลี่ยนรูปสิ่งของ', exact: true }),
  ).toBeEnabled();
  await settle(page);
  await mkdir(artifacts, { recursive: true });
  const photo = path.join(artifacts, 'photo.png');
  await page.screenshot({ path: photo });
  await testInfo.attach('Item photo layout', {
    path: photo,
    contentType: 'image/png',
  });
  const staleReads: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'GET' &&
      request.url().endsWith(`${reportPath()}/image`)
    )
      staleReads.push(request.url());
  });
  await dialog.getByRole('button', { name: 'ลบรูป', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'แนบรูปสิ่งของ', exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByRole('img')).toHaveCount(0);
  expect(staleReads).toEqual([]);
  await expect(dialog.getByRole('status')).toContainText('ลบรูปแล้ว');
});
