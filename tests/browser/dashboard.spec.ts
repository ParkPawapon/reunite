import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { authenticateBrowserAccount, browserAccount } from './test-account';

test.beforeEach(() => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Dashboard authentication uses the managed isolated test server',
  );
});

async function signIn(page: Page) {
  await authenticateBrowserAccount(page.request);
  const navigation = await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(navigation?.headers()['cache-control']).toContain('no-store');
  await expect(page.locator('[data-dashboard]')).toBeVisible();
}

test('shows the report board without a matching panel, an icon-only refresh control and real owner photo upload/removal', async ({
  page,
}) => {
  await signIn(page);
  const refresh = page.getByRole('button', {
    name: 'รีเฟรชรายการ',
    exact: true,
  });
  await expect(refresh).toHaveText('');
  await expect(refresh).toHaveAttribute('title', 'รีเฟรชรายการ');
  await expect(
    page.getByRole('heading', { name: 'อาจเป็นของชิ้นเดียวกัน', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('#matches')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'ของหายทดสอบ 12', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: 'แนบรูปสิ่งของ', exact: true }),
  ).toBeVisible();
  const photo = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#ff8800' },
  })
    .png()
    .toBuffer();
  await dialog.getByLabel('เลือกรูปสิ่งของ').setInputFiles({
    name: 'test-item.png',
    mimeType: 'image/png',
    buffer: photo,
  });
  await expect(
    dialog.getByRole('img', { name: 'รูป ของหายทดสอบ 12', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'เปลี่ยนรูปสิ่งของ', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'ลบรูป', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'แนบรูปสิ่งของ', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveCount(0);
  await dialog
    .getByRole('button', { name: 'ปิดรายละเอียด', exact: true })
    .click();
  expect((await page.request.get('/api/v1/matches')).status()).toBe(200);
});

test('protects the dashboard from missing, forged and duplicate sessions', async ({
  page,
  context,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.locator('[data-dashboard]').count()).toBe(0);
  await context.addCookies([
    {
      name: 'browser_test_session',
      value: 'a'.repeat(43),
      url: 'http://localhost:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  const duplicate = await page.request.get('/dashboard', {
    headers: {
      cookie: `browser_test_session=${'a'.repeat(43)}; browser_test_session=${'b'.repeat(43)}`,
    },
    maxRedirects: 0,
  });
  // Next.js emits a meta redirect after a loading boundary starts streaming.
  if (duplicate.status() === 307) {
    expect(duplicate.headers().location).toBe('/login');
  } else {
    expect(duplicate.status()).toBe(200);
    const html = await duplicate.text();
    expect(html).toContain('http-equiv="refresh" content="1;url=/login"');
    expect(html).not.toContain('data-dashboard=');
    expect(html).not.toContain(browserAccount.email);
  }
});

test('switches real LOST/FOUND data, resets pagination and opens current report details', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await expect(
    page.getByRole('tab', { name: 'ของหาย', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-report-id]')).toHaveCount(10);
  await expect(
    page.getByRole('button', { name: 'ของหายทดสอบ 12', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'หน้าก่อนหน้า', exact: true }),
  ).toBeDisabled();
  const status = page.getByLabel('สถานะประกาศ');
  await expect(status).toHaveValue('OPEN');
  await expect(page.getByRole('button', { name: 'หน้าถัดไป' })).toBeDisabled();
  await status.selectOption('RESOLVED');
  await expect(page.locator('[data-report-id]')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'ของหายทดสอบ 11', exact: true }),
  ).toBeVisible();
  await status.selectOption('CLOSED');
  await expect(page.locator('[data-report-id]')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'ของหายทดสอบ 10', exact: true }),
  ).toBeVisible();
  await status.selectOption('');
  await expect(page.locator('[data-report-id]')).toHaveCount(10);
  await page.getByRole('button', { name: 'หน้าถัดไป', exact: true }).click();
  await expect(page.locator('[data-report-id]')).toHaveCount(2);
  await expect(page.getByText('รายการ 11–12', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'หน้าถัดไป', exact: true }),
  ).toBeDisabled();
  await page.getByRole('tab', { name: 'ของที่พบ', exact: true }).click();
  await expect(page.locator('[data-report-id]')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'ของที่พบทดสอบ 2', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'หน้าก่อนหน้า', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('columnheader', { name: 'สถานที่พบ', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'ดูรายละเอียด ของที่พบทดสอบ 2', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'ของที่พบทดสอบ 2', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('รายละเอียดสำหรับทดสอบตาราง', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText('สถานที่ทดสอบ', { exact: true })).toBeVisible();
  await expect(dialog.getByText('วันที่แจ้ง', { exact: true })).toBeVisible();
  // Check the presented dialog, after its real finite entry transitions finish.
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) =>
          Number.isFinite(animation.effect?.getTiming().iterations),
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: 'ดูรายละเอียด ของที่พบทดสอบ 2',
      exact: true,
    }),
  ).toBeFocused();
  await page.getByRole('tab', { name: 'ของที่พบ', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByRole('tab', { name: 'ของหาย', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-report-id]')).toHaveCount(10);
  // Backend failures stay actionable; server internals are never shown to the user.
  await page.route('**/api/v1/item-reports?*', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: 'private SQL detail' } },
    }),
  );
  await page.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
  await expect(page.locator('[data-board-error]')).toContainText(
    'โหลดรายการไม่สำเร็จ',
  );
  await expect(page.getByText('private SQL detail')).toHaveCount(0);
  await page.unroute('**/api/v1/item-reports?*');
  await page.getByRole('button', { name: 'ลองอีกครั้ง', exact: true }).click();
  await expect(page.locator('[data-report-id]')).toHaveCount(10);
  await page.route('**/api/v1/item-reports?*', (route) =>
    route.fulfill({
      status: 200,
      json: { data: [], meta: { limit: 11, offset: 0 } },
    }),
  );
  await page.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ยังไม่มีรายการของหาย', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  const empty = await page
    .getByRole('heading', { name: 'ยังไม่มีรายการของหาย', exact: true })
    .boundingBox();
  expect(empty && empty.x >= 0 && empty.x + empty.width <= 320).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('keeps the newest tab when a previous report response arrives late', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tasks: Promise<void>[] = [];
  const lost = (url: URL) =>
    url.pathname === '/api/v1/item-reports' &&
    url.searchParams.get('type') === 'LOST';
  await page.route(lost, (route) => {
    const task = gate.then(async () => {
      await route.continue().catch(() => undefined);
    });
    tasks.push(task);
    return task;
  });
  try {
    await signIn(page);
    await expect(page.locator('[data-report-skeleton]')).toHaveCount(5);
    await page.getByRole('tab', { name: 'ของที่พบ', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'ของที่พบทดสอบ 2', exact: true }),
    ).toBeVisible();
    release();
    await Promise.all(tasks);
    await page.unroute(lost);
    await expect(
      page.getByRole('tab', { name: 'ของที่พบ', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-report-id]')).toHaveCount(2);
    await expect(
      page.getByRole('button', { name: 'ของหายทดสอบ 12', exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
    await Promise.all(tasks);
    await page.unroute(lost);
  }
});

test('uses real session data, responsive navigation, truthful report loading and working logout', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let pending: Promise<void> | undefined;
  const imageRequest = (url: URL) =>
    url.pathname === '/api/v1/item-reports' &&
    url.searchParams.get('type') === 'LOST';
  await page.route(imageRequest, async (route) => {
    pending = gate.then(() => route.continue());
    await pending;
  });
  try {
    await signIn(page);
    await expect(
      page.getByText(`สวัสดี, ${browserAccount.name}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await expect(page.locator('[data-report-skeleton]')).toHaveCount(5);
    await page.waitForTimeout(600);
    await expect(page.getByRole('tabpanel')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await page
      .getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true })
      .click();
    await expect(page.locator('[data-shell]')).toHaveAttribute(
      'data-shell-motion',
      'still',
    );
    // Let the click's finite hover/focus transitions report completion before checking idle.
    // Continuous animation is excluded from this wait and must still be stopped below.
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) =>
            Number.isFinite(animation.effect?.getTiming().iterations),
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            document
              .getAnimations()
              .filter((a) => a.playState === 'running')
              .map((a) => {
                const effect = a.effect as KeyframeEffect | null;
                const target = effect?.target;
                return {
                  name:
                    a.id ||
                    ('animationName' in a ? a.animationName : 'transition'),
                  iterations: effect?.getTiming().iterations,
                  target:
                    target instanceof Element
                      ? target.outerHTML.slice(0, 240)
                      : null,
                  shell:
                    target instanceof Element
                      ? target
                          .closest('[data-shell]')
                          ?.getAttribute('data-shell-motion')
                      : null,
                };
              }),
          ),
        { timeout: 1500 },
      )
      .toEqual([]);
    release();
    await pending;
    await page.unroute(imageRequest);
    await expect(page.getByRole('tabpanel')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await expect(page.locator('[data-report-id]')).toHaveCount(10);
    const original = await page.locator('main').boundingBox();
    await page.getByRole('button', { name: 'ย่อเมนู', exact: true }).click();
    await expect(page.locator('[data-shell]')).toHaveAttribute(
      'data-compact',
      'true',
    );
    await expect
      .poll(() =>
        page
          .locator('[data-shell]')
          .evaluate((element) =>
            parseFloat(getComputedStyle(element).gridTemplateColumns),
          ),
      )
      .toBe(88);
    const expanded = await page.locator('main').boundingBox();
    if (!original || !expanded)
      throw new Error('Dashboard content has no layout');
    expect(expanded.width).toBeGreaterThan(original.width);
    await page.getByRole('button', { name: 'ขยายเมนู', exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator('[data-shell]')
          .evaluate((element) =>
            parseFloat(getComputedStyle(element).gridTemplateColumns),
          ),
      )
      .toBe(248);
    await page.screenshot({
      path: 'tmp/dashboard/desktop.png',
      fullPage: true,
    });
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const sizing = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('body *')]
          .filter(
            (element) =>
              element.getBoundingClientRect().right > innerWidth + 1 &&
              getComputedStyle(element).visibility !== 'hidden',
          )
          .slice(0, 10)
          .map((element) => ({
            tag: element.tagName,
            class: element.className,
            right: element.getBoundingClientRect().right,
          })),
      }));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        JSON.stringify(sizing),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(result.violations, JSON.stringify(result.violations)).toEqual([]);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.right > window.innerWidth + 1 &&
            getComputedStyle(element).visibility !== 'hidden'
          );
        })
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName,
          class: element.getAttribute('class'),
          right: element.getBoundingClientRect().right,
        })),
    );
    await page.screenshot({ path: 'tmp/dashboard/zoom.png', fullPage: true });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      JSON.stringify(overflow),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.removeProperty('font-size');
    });
    await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'ปิดเมนู', exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'ปิดเมนู', exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'เปิดเมนู', exact: true }),
    ).toBeFocused();
    await page.screenshot({ path: 'tmp/dashboard/mobile.png', fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-shell]')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
    expect(
      await page
        .locator('[data-shell]')
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toBe('0s');
    expect(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === 'running')
            .length,
      ),
    ).toBe(0);
    await page.route(imageRequest, (route) => route.abort());
    await page.reload();
    await expect(
      page.getByText('โหลดรายการไม่สำเร็จ', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click();
    await expect(
      page
        .getByRole('dialog', { name: 'เมนูนำทาง' })
        .getByRole('link', { name: 'แผนที่บางมด', exact: true }),
    ).toHaveAttribute('href', '/map');
    await page.keyboard.press('Escape');
    const map = await page.request.get('/map');
    expect(map.headers()['permissions-policy']).toContain('geolocation=(self)');
    await page
      .getByRole('button', { name: 'บัญชีของคุณ', exact: true })
      .click();
    await expect(
      page.getByText(browserAccount.email, { exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.route('**/api/v1/auth/logout', (route) =>
      route.fulfill({
        status: 503,
        json: { error: { message: 'Untrusted error detail' } },
      }),
    );
    await page
      .getByRole('menuitem', { name: 'ออกจากระบบ', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText('ออกจากระบบไม่สำเร็จ');
    await expect(page.getByText('Untrusted error detail')).toHaveCount(0);
    await page.unroute('**/api/v1/auth/logout');
    await page
      .getByRole('menuitem', { name: 'ออกจากระบบ', exact: true })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
    await testInfo.attach('desktop', {
      path: 'tmp/dashboard/desktop.png',
      contentType: 'image/png',
    });
  } finally {
    release();
    await pending;
  }
});
