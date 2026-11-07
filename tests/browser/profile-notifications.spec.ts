import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { browserAccount } from './test-account';

async function settleMotion(page: import('@playwright/test').Page) {
  // Contrast checks and screenshots use finished finite transitions, never a partial fade.
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect?.getComputedTiming().iterations !== Infinity,
      );
    await Promise.all(
      finite.map((animation) => animation.finished.catch(() => {})),
    );
  });
}

test.beforeEach(() =>
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Requires the managed disposable database',
  ),
);

test('edits a real private profile, uploads a photo and reads account notifications', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/profile')).status()).toBe(401);
  const login = await page.request.post('/api/v1/auth/login', {
    headers: { origin: 'http://localhost:3100' },
    data: { email: browserAccount.email, password: browserAccount.password },
  });
  expect(login.status()).toBe(200);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/notifications', async (route) => {
    if (route.request().method() === 'GET') {
      await gate;
      await route.continue();
    } else await route.continue();
  });
  try {
    await page.goto('/dashboard');
    await expect(page.locator('footer a')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'การแจ้งเตือน', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'การแจ้งเตือน', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'กำลังโหลดการแจ้งเตือน' }),
    ).toBeVisible();
    release();
    await expect(
      page.getByText('ยังไม่มีข่าวใหม่', { exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#notification-panel')).toHaveCount(0);
    await expect(
      page.getByRole('dialog', { name: 'การแจ้งเตือน', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'การแจ้งเตือน', exact: true }),
    ).toBeFocused();
  } finally {
    release();
  }
  await page.unroute('**/api/v1/notifications');
  await page.getByRole('button', { name: 'บัญชีของคุณ', exact: true }).click();
  await page.getByRole('menuitem', { name: 'โปรไฟล์ของฉัน' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole('heading', { name: 'โปรไฟล์ของฉัน', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'ชื่อจริง', exact: false }),
  ).toHaveValue('');
  await page.getByLabel('ชื่อจริง', { exact: false }).fill('สมชาย');
  await page.getByLabel('นามสกุล', { exact: false }).fill('ใจดี');
  await page.getByLabel('รหัสนักศึกษา', { exact: true }).fill('1234567890123');
  await page.getByLabel('คณะ', { exact: true }).fill('คณะสำหรับทดสอบ');
  await page.getByLabel('ภาควิชา', { exact: true }).fill('ภาควิชาสำหรับทดสอบ');
  await page.getByLabel('สาขาวิชา', { exact: true }).fill('สาขาสำหรับทดสอบ');
  await page.getByLabel('เบอร์โทรศัพท์', { exact: true }).fill('0812345678');
  await page
    .getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'บันทึกข้อมูลเรียบร้อยแล้ว',
  );
  await expect(page.locator('#account-button')).toContainText('สมชาย ใจดี');
  await expect(
    page.getByRole('button', { name: 'การแจ้งเตือน ยังไม่อ่าน 1 รายการ' }),
  ).toBeVisible();
  const photo = await sharp({
    create: { width: 400, height: 400, channels: 3, background: '#FFC72C' },
  })
    .png()
    .toBuffer();
  let releaseUpload = () => {};
  let releaseImage = () => {};
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  const imageGate = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route('**/api/v1/profile/avatar*', async (route) => {
    await (route.request().method() === 'PUT' ? uploadGate : imageGate);
    await route.continue();
  });
  try {
    await page.getByLabel('เลือกรูปโปรไฟล์').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: photo,
    });
    await expect(
      page.locator('aside[aria-label="รูปและข้อมูลบัญชี"] [aria-busy="true"]'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'เปลี่ยนรูปโปรไฟล์', exact: true }),
    ).toBeDisabled();
    releaseUpload();
    await expect(page.getByRole('status')).toContainText(
      'บันทึกรูปโปรไฟล์เรียบร้อยแล้ว',
    );
    await expect(
      page.locator('#account-button [data-ready="false"]'),
    ).toBeVisible();
    releaseImage();
    await expect(
      page.locator('#account-button [data-ready="true"]'),
    ).toBeVisible();
  } finally {
    releaseUpload();
    releaseImage();
  }
  await page.unroute('**/api/v1/profile/avatar*');
  await expect(page.locator('#account-button img')).toBeVisible();
  const image = await page.request.get('/api/v1/profile/avatar');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/webp');
  await page.reload();
  await expect(page.getByLabel('ชื่อจริง', { exact: false })).toHaveValue(
    'สมชาย',
  );
  await expect(page.getByLabel('รหัสนักศึกษา', { exact: true })).toHaveValue(
    '1234567890123',
  );
  await expect(page.locator('#account-button img')).toBeVisible();
  const bell = page.getByRole('button', { name: /^การแจ้งเตือน/ });
  await bell.click();
  const panel = page.getByRole('dialog', { name: 'การแจ้งเตือน', exact: true });
  await expect(
    panel.getByText('บันทึกโปรไฟล์แล้ว', { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText('อัปเดตรูปโปรไฟล์แล้ว', { exact: true }),
  ).toBeVisible();
  await settleMotion(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: 'tmp/profile/notifications.png' });
  await panel.getByRole('button', { name: 'อ่านทั้งหมด', exact: true }).click();
  await expect(panel.getByText('อ่านครบแล้ว', { exact: true })).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'อ่านทั้งหมด', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('#notification-panel')).toHaveCount(0);
  await page.route('**/api/v1/notifications', (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { code: 'UNAVAILABLE', message: 'Private backend details' },
      },
    }),
  );
  await bell.click();
  await expect(panel.getByRole('alert')).toContainText(
    'โหลดการแจ้งเตือนไม่สำเร็จ',
  );
  await expect(page.getByText('Private backend details')).toHaveCount(0);
  await page.unroute('**/api/v1/notifications');
  await panel.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(
    panel.getByRole('heading', { name: 'การแจ้งเตือน', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('#notification-panel')).toHaveCount(0);
  await settleMotion(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: 'tmp/profile/desktop.png', fullPage: true });
  await testInfo.attach('profile desktop', {
    path: 'tmp/profile/desktop.png',
    contentType: 'image/png',
  });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tmp/profile/mobile.png', fullPage: true });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await bell.click();
  await expect(panel).toBeVisible();
  expect(
    await panel.evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .every((duration) => Number.parseFloat(duration) === 0),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#notification-panel')).toHaveCount(0);
  expect(errors).toEqual([]);
});
