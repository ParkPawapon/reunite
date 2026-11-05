import { test, expect } from '@playwright/test';

async function openPreview(page: import('@playwright/test').Page) {
  await page.goto('/research/loading-screen');
  await expect(
    page.getByRole('heading', { name: 'ตัวอย่างหน้ากำลังโหลด' }),
  ).toBeVisible();
}

test('renders only the mascot and status across phone, tablet, desktop and landscape', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1440, 1000],
    [844, 390],
  ] as const) {
    await page.setViewportSize({ width, height });
    await openPreview(page);
    await expect(page.getByRole('status')).toHaveText('กำลังโหลด…');
    await expect(
      page.locator('[data-reduced-motion=true]:visible'),
    ).toBeVisible();
    expect(await page.locator('header, footer').count()).toBe(0);
    expect(await page.getByRole('progressbar').count()).toBe(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    const bounds = await page.locator('[data-honk-art]').boundingBox();
    const status = await page.getByRole('status').boundingBox();
    expect(bounds).not.toBeNull();
    expect(status).not.toBeNull();
    if (!bounds || !status) throw new Error('Missing loading artwork/status');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(status.y + status.height).toBeLessThanOrEqual(height);
  }
  expect(errors).toEqual([]);
});

test('animates with Motion, pauses at the current pose and resumes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openPreview(page);
  const loader = page.locator('[data-loading-screen]');
  await expect(loader).toHaveAttribute('data-animation', 'running');
  await page.evaluate(() => document.fonts.ready);
  const art = page.locator('[data-honk-art]');
  const before = await art.screenshot();
  await page.waitForTimeout(650);
  expect(await art.screenshot()).not.toEqual(before);
  await page.getByRole('button', { name: 'หยุดภาพเคลื่อนไหว' }).click();
  await expect(loader).toHaveAttribute('data-animation', 'still');
  await expect
    .poll(() =>
      loader.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === 'running').length,
      ),
    )
    .toBe(0);
  const paused = await art.screenshot();
  await page.waitForTimeout(350);
  expect(await art.screenshot()).toEqual(paused);
  await page.getByRole('button', { name: 'เล่นภาพเคลื่อนไหว' }).click();
  await expect(loader).toHaveAttribute('data-animation', 'running');
  await page.waitForTimeout(650);
  expect(await art.screenshot()).not.toEqual(paused);
  expect(errors).toEqual([]);
});

test('respects reduced motion initially and when the device preference changes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPreview(page);
  const loader = page.locator('[data-loading-screen]');
  await expect(loader).toHaveAttribute('data-reduced-motion', 'true');
  await expect(loader).toHaveAttribute('data-animation', 'still');
  await expect(loader.getByRole('button')).toHaveCount(0);
  const art = page.locator('[data-honk-art]');
  const still = await art.screenshot();
  await page.waitForTimeout(350);
  expect(await art.screenshot()).toEqual(still);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(loader).toHaveAttribute('data-animation', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(loader).toHaveAttribute('data-animation', 'still');
});

test('pauses in a hidden document without losing keyboard focus', async ({
  page,
}) => {
  await openPreview(page);
  const loader = page.locator('[data-loading-screen]');
  await expect(loader).toHaveAttribute('data-animation', 'running');
  const button = page.getByRole('button', { name: 'หยุดภาพเคลื่อนไหว' });
  await button.focus();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(loader).toHaveAttribute('data-animation', 'still');
  await expect(button).toBeFocused();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(loader).toHaveAttribute('data-animation', 'running');
});

test('keeps a useful static server-rendered screen without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/research/loading-screen');
  await expect(page.getByRole('status')).toHaveText('กำลังโหลด…');
  await expect(page.locator('[data-honk-art]:visible')).toBeVisible();
  await expect(page.locator('[data-loading-screen]:visible')).toHaveAttribute(
    'data-animation',
    'still',
  );
  await expect(page.getByRole('button')).toHaveCount(0);
  await context.close();
});
