import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  statusCodes,
  statusCatalog,
} from '../../apps/web/src/components/status/status-catalog';

test('keeps real HTTP redirects, not-found responses and JSON API errors correct', async ({
  page,
  context,
}) => {
  const missing = await page.goto('/a-page-that-does-not-exist');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'เอ… หน้านี้อยู่ไหนนะ',
  );
  await expect(
    page.getByRole('link', { name: 'กลับหน้าภาพรวม', exact: true }),
  ).toHaveAttribute('href', '/dashboard');
  expect((await page.request.get('/status/999')).status()).toBe(404);
  const redirect = await page.request.get('/', { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers().location).toBe('/login');
  await context.clearCookies();
  const denied = await page.request.get('/api/v1/profile');
  expect(denied.status()).toBe(401);
  expect(denied.headers()['content-type']).toContain('application/json');
  expect((await denied.json()).error.code).toBe('UNAUTHORIZED');
});

test('renders all 22 distinct state scenes with responsive accessible actions', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const scenes = new Set<string>();
  for (const code of statusCodes) {
    const response = await page.goto(`/status/${code}`);
    expect(response?.status()).toBe(200); // Explicitly labeled design previews.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      statusCatalog[code].title,
    );
    const scene = page.locator('[data-scene]');
    scenes.add(
      await scene
        .locator('svg')
        .first()
        .evaluate(
          (_node) => document.querySelector('[data-scene]')?.innerHTML ?? '',
        ),
    );
    await expect(page.locator('[data-status-page]')).toHaveAttribute(
      'data-status-page',
      code,
    );
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
      `WCAG checks for ${code}`,
    ).toEqual([]);
    if (['307', '403', '404', '500', '503'].includes(code)) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: `tmp/status/${code}.png`, fullPage: true });
      await testInfo.attach(`Status ${code}`, {
        path: `tmp/status/${code}.png`,
        contentType: 'image/png',
      });
    }
  }
  expect(scenes.size).toBe(22);
  expect(errors).toEqual([]);
  await page.goto('/research/system-states');
  expect(await page.locator('a[href^="/status/"]').count()).toBe(22);
});

test('pauses and resumes artwork, respects reduced motion and supports recovery links without JavaScript', async ({
  page,
  browser,
}) => {
  await page.goto('/status/404');
  await expect(page.locator('[data-status-page]')).toHaveAttribute(
    'data-motion',
    'running',
  );
  await page
    .getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true })
    .click();
  await expect(page.locator('[data-status-page]')).toHaveAttribute(
    'data-motion',
    'still',
  );
  expect(
    await page
      .locator('[data-scene]')
      .evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === 'running').length,
      ),
  ).toBe(0);
  await page
    .getByRole('button', { name: 'เล่นภาพเคลื่อนไหว', exact: true })
    .click();
  await expect(page.locator('[data-status-page]')).toHaveAttribute(
    'data-motion',
    'running',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-status-page]')).toHaveAttribute(
    'data-motion',
    'still',
  );
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await context.newPage();
    const baseURL = new URL(page.url()).origin;
    const response = await staticPage.goto(
      `${baseURL}/missing-without-javascript`,
    );
    expect(response?.status()).toBe(404);
    await expect(staticPage.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      staticPage.getByRole('link', { name: 'กลับหน้าภาพรวม', exact: true }),
    ).toHaveAttribute('href', '/dashboard');
  } finally {
    await context.close();
  }
});
