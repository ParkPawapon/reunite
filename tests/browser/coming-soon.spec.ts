import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { readdir, readFile } from 'node:fs/promises';
import { LAUNCH_AT } from '../../apps/web/src/components/coming-soon/launch';

const model = '**/research/kmutt-bangmod/kmutt-bangmod-web.glb';
const world = (page: Page) => page.locator('[data-campus-world]');
const digits = (page: Page) =>
  page.locator('[data-launch-countdown] [data-unit]');
type ProbedWindow = Window & { __launchDraws?: number };
async function probe(page: Page) {
  await page.addInitScript(() => {
    const target = window as ProbedWindow;
    target.__launchDraws = 0;
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (
      ...args: Parameters<typeof draw>
    ) {
      if (
        this.canvas instanceof HTMLCanvasElement &&
        this.canvas.closest('[data-campus-world]')
      )
        target.__launchDraws = (target.__launchDraws ?? 0) + 1;
      return draw.apply(this, args);
    };
  });
}
const draws = (page: Page) =>
  page.evaluate(() => (window as ProbedWindow).__launchDraws ?? 0);
async function changed(first: Buffer, second: Buffer) {
  const a = await sharp(first).ensureAlpha().raw().toBuffer();
  const b = await sharp(second).ensureAlpha().raw().toBuffer();
  expect(a.length).toBe(b.length);
  let count = 0;
  for (let i = 0; i < a.length; i += 4)
    if (
      Math.max(
        Math.abs((a[i] ?? 0) - (b[i] ?? 0)),
        Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)),
        Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0)),
      ) > 8
    )
      count++;
  return count / (a.length / 4);
}

test('public server HTML contains the launch date and local poster before hydration', async ({
  request,
  page,
}) => {
  const response = await request.get('/coming-soon');
  expect(response.status()).toBe(200);
  expect(response.headers()['permissions-policy']).toContain('geolocation=()');
  const html = await response.text();
  expect(html).toContain('24 พฤศจิกายน 2569');
  expect(html).toContain('2026-11-24T00:00:00+07:00');
  expect(html).toContain('bangmod-launch.png');
  expect(html).not.toMatch(/cdn\.tailwindcss|iconify|supabase\.co/);
  const outgoing: string[] = [];
  page.on('request', (event) => {
    if (new URL(event.url()).origin !== new URL(response.url()).origin)
      outgoing.push(event.url());
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/coming-soon');
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
  await expect(page).toHaveTitle('Reunite — พบกัน 24 พฤศจิกายน 2569');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'กำลังกลับมา',
  );
  expect(outgoing).toEqual([]);
  expect(errors).toEqual([]);
});

test('stops GPU/CSS motion while keeping countdown live, and completes a manual 360 orbit', async ({
  page,
}) => {
  await probe(page);
  await page.goto('/coming-soon');
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
  await page
    .getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true })
    .click();
  await page.waitForTimeout(200);
  const before = await draws(page);
  const seconds = await page.locator('[data-unit="seconds"]').textContent();
  await page.waitForTimeout(1300);
  expect(await draws(page)).toBe(before);
  expect(before).toBeGreaterThan(0);
  expect(await page.locator('[data-unit="seconds"]').textContent()).not.toBe(
    seconds,
  );
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === 'running' &&
              animation.effect?.getTiming().iterations === Infinity,
          ).length,
    ),
  ).toBe(0);
  await page
    .getByRole('button', { name: 'คืนมุมมองเริ่มต้น', exact: true })
    .click();
  const canvas = page.locator('[data-campus-world] canvas');
  const front = await canvas.screenshot();
  for (let i = 0; i < 8; i++)
    await page
      .getByRole('button', { name: 'หมุนโมเดลไปทางขวา', exact: true })
      .click();
  const back = await canvas.screenshot();
  expect(await changed(front, back)).toBeGreaterThan(0.02);
  for (let i = 0; i < 8; i++)
    await page
      .getByRole('button', { name: 'หมุนโมเดลไปทางขวา', exact: true })
      .click();
  expect(await changed(front, await canvas.screenshot())).toBeLessThan(0.01);
  await canvas.focus();
  await page.keyboard.press('ArrowLeft');
  expect(await changed(front, await canvas.screenshot())).toBeGreaterThan(0.01);
  await page.keyboard.press('Home');
  expect(await changed(front, await canvas.screenshot())).toBeLessThan(0.01);
  await page
    .getByRole('button', { name: 'เล่นภาพเคลื่อนไหว', exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(200);
  const reduced = await draws(page);
  await page.waitForTimeout(500);
  expect(await draws(page)).toBe(reduced);
});

test('recovers model download failure and WebGL context loss with a fresh canvas', async ({
  page,
}) => {
  let failing = true;
  await page.route(model, (route) =>
    failing
      ? route.fulfill({ status: 503, body: 'unavailable' })
      : route.continue(),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/coming-soon');
  await expect(world(page)).toHaveAttribute('data-state', 'error');
  await expect(
    page.getByAltText(
      'โมเดลมหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี วิทยาเขตบางมด',
    ),
  ).toBeVisible();
  const before = await digits(page).allTextContents();
  await page.waitForTimeout(1100);
  expect(await digits(page).allTextContents()).not.toEqual(before);
  failing = false;
  await page
    .getByRole('button', { name: 'ลองเปิด 3D อีกครั้ง', exact: true })
    .click();
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
  await page.locator('canvas').evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context loss extension unavailable');
    extension.loseContext();
  });
  await expect(world(page)).toHaveAttribute('data-state', 'error');
  await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  await page
    .getByRole('button', { name: 'ลองเปิด 3D อีกครั้ง', exact: true })
    .click();
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
  expect(errors).toEqual([]);
  const contextHandle = await page
    .locator('canvas')
    .evaluateHandle((element) =>
      (element as HTMLCanvasElement).getContext('webgl2'),
    );
  await page.clock.setFixedTime(new Date(LAUNCH_AT + 1000));
  await page.getByRole('link', { name: 'เริ่มภารกิจ', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() => contextHandle.evaluate((context) => context?.isContextLost()))
    .toBe(true);
  await contextHandle.dispose();
});

test('keeps real rendering useful on mobile, without JavaScript or without WebGL', async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/coming-soon');
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
  for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    const boxes = await page
      .locator('h1, [data-launch-countdown], header')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          scroll: element.scrollWidth,
          width: element.clientWidth,
        })),
      );
    for (const box of boxes)
      expect(box.scroll).toBeLessThanOrEqual(box.width + 1);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({
      path: `tmp/coming-soon/production-${width}.png`,
      fullPage: true,
    });
  }
  const noJs = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto('/coming-soon');
  await expect(
    staticPage.getByText('24 พฤศจิกายน 2569', { exact: true }),
  ).toBeVisible();
  await expect(
    staticPage.getByAltText(
      'โมเดลมหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี วิทยาเขตบางมด',
    ),
  ).toBeVisible();
  await expect(
    staticPage.getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true }),
  ).toBeHidden();
  await noJs.close();
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown,
    ) {
      if (type.startsWith('webgl')) return null;
      return get.call(this, type, options);
    } as typeof get;
  });
  await page.reload();
  await expect(world(page)).toHaveAttribute('data-state', 'error');
  await expect(
    page.getByRole('button', { name: 'ลองเปิด 3D อีกครั้ง', exact: true }),
  ).toBeVisible();
});

test('uses Thai midnight in every browser timezone, reaches zero once and opens the actual login', async ({
  browser,
  baseURL,
}) => {
  if (!baseURL)
    throw new Error('The browser test requires a configured base URL.');
  for (const timezoneId of [
    'Asia/Bangkok',
    'America/New_York',
    'Pacific/Honolulu',
  ]) {
    const context = await browser.newContext({
      baseURL,
      timezoneId,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.route(model, (route) =>
      route.fulfill({ status: 503, body: 'unavailable' }),
    );
    await page.clock.setFixedTime(new Date(LAUNCH_AT - 1));
    await page.goto('/coming-soon');
    await expect(page.locator('[data-unit="seconds"]')).toHaveText('01');
    await expect(
      page.getByRole('link', { name: 'เริ่มภารกิจ', exact: true }),
    ).toHaveCount(0);
    await page.clock.setFixedTime(new Date(LAUNCH_AT));
    await expect(digits(page)).toHaveText(['00', '00', '00', '00']);
    await expect(
      page.getByRole('link', { name: 'เริ่มภารกิจ', exact: true }),
    ).toHaveAttribute('href', '/login');
    await page.clock.setFixedTime(new Date(LAUNCH_AT + 86400000));
    await expect(digits(page)).toHaveText(['00', '00', '00', '00']);
    await page.getByRole('link', { name: 'เริ่มภารกิจ', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await context.close();
  }
});

test('suspends offscreen/hidden rendering and retains pause during a slow model download', async ({
  page,
}) => {
  await probe(page);
  await page.goto('/coming-soon');
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-coming-soon]')).toHaveAttribute(
    'data-motion',
    'still',
  );
  await page.waitForTimeout(200);
  const hidden = await draws(page);
  await page.waitForTimeout(600);
  expect(await draws(page)).toBe(hidden);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    Reflect.deleteProperty(document, 'visibilityState');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => draws(page)).toBeGreaterThan(hidden);
  await page.evaluate(() => {
    document.body.style.minHeight = '2600px';
    scrollTo(0, 1600);
  });
  await page.waitForTimeout(350);
  const offscreen = await draws(page);
  await page.waitForTimeout(600);
  expect(await draws(page)).toBe(offscreen);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => draws(page)).toBeGreaterThan(offscreen);
  await page.route(model, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  const pending = page.waitForRequest((request) =>
    request.url().endsWith('/kmutt-bangmod-web.glb'),
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pending;
  await expect(page.locator('[data-unit="seconds"]')).not.toHaveText('—');
  const seconds = await page.locator('[data-unit="seconds"]').textContent();
  await page.waitForTimeout(1200);
  expect(await page.locator('[data-unit="seconds"]').textContent()).not.toBe(
    seconds,
  );
  await expect(world(page)).toHaveAttribute('data-state', 'loading');
  await page
    .getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true })
    .click();
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
  await page.waitForTimeout(200);
  const paused = await draws(page);
  await page.waitForTimeout(600);
  expect(await draws(page)).toBe(paused);
});

test('isolates lazy scene chunk failure and offers document reload recovery', async ({
  page,
}) => {
  const files = await readdir('apps/web/.next/static/chunks');
  let chunk: string | undefined;
  for (const file of files.filter((file) => file.endsWith('.js'))) {
    if (
      (await readFile(`apps/web/.next/static/chunks/${file}`, 'utf8')).includes(
        'Batching changed the campus geometry.',
      )
    ) {
      chunk = file;
      break;
    }
  }
  expect(chunk).toBeTruthy();
  let failing = true;
  await page.route(`**/_next/static/chunks/${chunk}`, (route) =>
    failing
      ? route.fulfill({ status: 503, body: 'unavailable' })
      : route.continue(),
  );
  await page.goto('/coming-soon');
  await expect(world(page)).toHaveAttribute('data-state', 'error');
  await expect(
    page.getByRole('button', { name: 'โหลดหน้าใหม่', exact: true }),
  ).toBeVisible();
  failing = false;
  await page.getByRole('button', { name: 'โหลดหน้าใหม่', exact: true }).click();
  await expect(world(page)).toHaveAttribute('data-state', 'ready', {
    timeout: 45000,
  });
});
