import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { browserAccount } from './test-account';

test.beforeEach(() => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Dashboard authentication uses the managed isolated test server',
  );
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('อีเมล', { exact: true }).fill(browserAccount.email);
  await page
    .getByLabel('รหัสผ่าน', { exact: true })
    .fill(browserAccount.password);
  const navigation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/dashboard') &&
      response.request().isNavigationRequest(),
  );
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await navigation).headers()['cache-control']).toContain('no-store');
  await expect(page.locator('[data-dashboard]')).toBeVisible();
}

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

test('uses real session data, responsive navigation, truthful image loading and working logout', async ({
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
    url.pathname === '/_next/image' &&
    (url.searchParams.get('url') ?? '').endsWith('/bangmod-campus.webp');
  await page.route(imageRequest, async (route) => {
    pending = gate.then(() => route.continue());
    await pending;
  });
  try {
    await signIn(page);
    await expect(
      page.getByText(`สวัสดี, ${browserAccount.name}`, { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-campus-preview]')).toHaveAttribute(
      'data-campus-preview',
      'loading',
    );
    await page.waitForTimeout(600);
    await expect(page.locator('[data-campus-preview]')).toHaveAttribute(
      'data-campus-preview',
      'loading',
    );
    await page
      .getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true })
      .click();
    await expect(page.locator('[data-shell]')).toHaveAttribute(
      'data-shell-motion',
      'still',
    );
    // The click's short hover/focus feedback may finish before motion is idle.
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
    await expect(page.locator('[data-campus-preview]')).toHaveAttribute(
      'data-campus-preview',
      'ready',
    );
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
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
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
      page.getByText('เปิดภาพตัวอย่างไม่สำเร็จ', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'เปิดแผนที่บางมด', exact: true }),
    ).toHaveAttribute('href', '/research/kmutt-bangmod');
    const map = await page.request.get('/research/kmutt-bangmod');
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
