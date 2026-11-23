import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { browserAccount, authenticateBrowserAccount } from './test-account';

const kmuttSignIn = { name: 'Sign in with KMUTT account', exact: true };

function formChunkPattern() {
  const folder = 'apps/web/.next/static/chunks';
  const chunks = readdirSync(folder).filter(
    (name) =>
      name.endsWith('.js') &&
      readFileSync(`${folder}/${name}`, 'utf8').includes('data-login-form'),
  );
  expect(chunks).toHaveLength(1);
  return `**/_next/static/chunks/${chunks[0]}`;
}

async function openLogin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true }),
  ).toBeVisible();
}

test('starts Microsoft sign-in once and returns a readable failure with the intended destination', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/auth/microsoft?*', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(new URL(route.request().url()).searchParams.get('next')).toBe(
      '/map#from=N7&to=S3',
    );
    await gate;
    await route.fulfill({
      status: 303,
      headers: {
        location: '/login?next=%2Fmap%23from%3DN7%26to%3DS3&microsoft=denied',
      },
    });
  });
  await page.goto('/login?next=map#from=N7&to=S3');
  const panel = page.locator('[data-login-form]');
  const microsoft = panel.getByRole('button', kmuttSignIn);
  await expect(microsoft).toBeEnabled();
  await expect(panel.getByRole('button')).toHaveCount(1);
  await expect(panel.locator('input')).toHaveCount(0);
  const logo = microsoft.locator('img[src="/kmutt-logo.png"]');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty('naturalWidth', 83);
  let pendingControls: string[] | undefined;
  await page.exposeFunction('recordMicrosoftPending', (controls: string[]) => {
    pendingControls = controls;
  });
  await microsoft.evaluate((button) => {
    const form = button.closest('form');
    const panel = button.closest('[data-login-form]');
    if (!form || !panel) throw new Error('Missing login controls');
    const report = (
      window as Window & {
        recordMicrosoftPending?: (controls: string[]) => void;
      }
    ).recordMicrosoftPending;
    if (!report) throw new Error('Missing pending-state observer');
    // Playwright locators wait for the navigation to commit, so observe the
    // outgoing document while the intercepted POST is still pending.
    const observer = new MutationObserver(() => {
      if (form.getAttribute('aria-busy') !== 'true') return;
      observer.disconnect();
      const disabled = panel.querySelectorAll('button[type="submit"]:disabled');
      report(Array.from(disabled, (control) => control.textContent ?? ''));
    });
    observer.observe(form, {
      attributes: true,
      attributeFilter: ['aria-busy'],
    });
  });
  await microsoft.click({ noWaitAfter: true });
  try {
    await expect.poll(() => pendingControls).toEqual(['กำลังเปิด Microsoft…']);
  } finally {
    release();
  }
  await expect(
    page.locator('[data-login-form]').getByRole('alert'),
  ).toContainText('กรุณาใช้บัญชี Microsoft ของ มจธ. ที่ได้รับสิทธิ์เข้าใช้งาน');
  await expect(page.getByRole('button', kmuttSignIn)).toBeEnabled();
});

test('opens the root with a 1.3-second intro when the form chunk is cached', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Isolate the welcome deadline from cold code/network loading, covered below.
  await openLogin(page);
  await page.evaluate(() => document.fonts.ready);
  await page.clock.install();
  await page.addInitScript(() => {
    const timing = { start: null as number | null, end: null as number | null };
    (
      window as Window & { loginWelcomeTiming?: typeof timing }
    ).loginWelcomeTiming = timing;
    new MutationObserver(() => {
      if (
        timing.start === null &&
        document.querySelector('[data-login-intro] [data-animation=running]')
      )
        timing.start = performance.now();
      if (timing.end === null && document.querySelector('[data-login-screen]'))
        timing.end = performance.now();
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('[data-login-intro]')).toBeVisible();
  await expect(
    page.locator('[data-login-intro] [data-animation=running]:visible'),
  ).toBeVisible();
  await page.clock.runFor(600);
  await expect(page.locator('[data-login-screen]')).toHaveCount(0);
  await expect(page.locator('[data-login-skeleton]')).toBeVisible();
  await page.clock.runFor(700);
  await expect(page.locator('[data-login-screen]')).toBeVisible();
  const elapsed = await page.evaluate(() => {
    const timing = (
      window as Window & {
        loginWelcomeTiming?: { start: number | null; end: number | null };
      }
    ).loginWelcomeTiming;
    if (!timing || timing.start === null || timing.end === null)
      throw new Error('Missing welcome timing');
    return timing.end - timing.start;
  });
  expect(elapsed).toBeGreaterThanOrEqual(1200);
  expect(elapsed).toBeLessThan(1800);
  await expect(
    page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true }),
  ).toBeFocused();
  for (const text of ['Email', 'Password', 'ใช้บัญชีที่ได้รับจากผู้ดูแลระบบ'])
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('keeps a real chunk-loading skeleton aligned with the form and respects motion controls', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pattern = formChunkPattern();
    await page.route(pattern, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-login-skeleton]')).toBeVisible();
    await page.waitForTimeout(850);
    await expect(page.locator('[data-login-screen]')).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);
    const shell = page.locator('[data-login-shell]');
    await expect(
      page.getByRole('region', {
        name: 'กำลังเตรียมหน้าเข้าสู่ระบบ',
        exact: true,
      }),
    ).toHaveAttribute('aria-busy', 'true');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    if (width === 1440) {
      await page
        .getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true })
        .click();
    } else {
      await expect(
        page.getByRole('button', { name: 'หยุดภาพเคลื่อนไหว', exact: true }),
      ).toHaveCount(0);
    }
    await expect(shell).toHaveAttribute('data-animation', 'still');
    await expect
      .poll(() =>
        shell.evaluate(
          (element) =>
            element
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
      )
      .toBe(0);
    const skeleton = await page
      .locator('[data-skeleton-for="kmutt"]')
      .boundingBox();
    release();
    await expect(page.locator('[data-login-screen]')).toBeVisible();
    await expect(page.locator('[data-login-skeleton]')).toHaveCount(0);
    if (!skeleton) throw new Error('Missing sign-in skeleton');
    await expect(async () => {
      const control = await page.getByRole('button', kmuttSignIn).boundingBox();
      if (!control) throw new Error('Missing sign-in button');
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(Math.abs(skeleton[key] - control[key])).toBeLessThanOrEqual(2.1);
    }).toPass({ timeout: 2000 });
    if (width === 1440)
      await expect(
        page.getByRole('button', { name: 'เล่นภาพเคลื่อนไหว', exact: true }),
      ).toBeFocused();
    await page.unroute(pattern);
  }
  expect(errors).toEqual([]);
});

test('recovers from a failed login-form chunk with a working reload action', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const pattern = formChunkPattern();
  await page.route(pattern, (route) => route.abort());
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-login-load-error]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'เปิดหน้าเข้าสู่ระบบไม่สำเร็จ' }),
  ).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await page.unroute(pattern);
  await page.getByRole('button', { name: 'ลองโหลดใหม่', exact: true }).click();
  await expect(page.locator('[data-login-screen]')).toBeVisible();
  await expect(page.getByRole('button', kmuttSignIn)).toBeVisible();
  expect(errors).toEqual([]);
});

test('offers a working reload when the login-form download stalls', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const pattern = formChunkPattern();
  let release = () => {};
  let allowRecovery = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending: Promise<void>[] = [];
  await page.route(pattern, async (route) => {
    if (allowRecovery) {
      await route.continue();
      return;
    }
    const failed = page.waitForEvent(
      'requestfailed',
      (request) => request === route.request(),
    );
    const settled = (async () => {
      await gate;
      await route.abort();
      await failed;
    })();
    pending.push(settled);
    await settled;
  });
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-login-skeleton]')).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-login-skeleton]')).toBeVisible();
    await expect(page.locator('[data-login-screen]')).toHaveCount(0);
    await expect(page.locator('[data-login-load-error]')).toBeVisible({
      timeout: 18_000,
    });
    await expect(page.locator('input')).toHaveCount(0);
    // Wait for Chromium's failure event, not only acknowledgement of the abort command.
    // The rejected import cannot recover until the user starts a new document.
    release();
    await Promise.all(pending);
    allowRecovery = true;
    await expect(page.locator('[data-login-load-error]')).toBeVisible();
    await page
      .getByRole('button', { name: 'ลองโหลดใหม่', exact: true })
      .click();
    await expect(page.locator('[data-login-screen]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', kmuttSignIn)).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    release();
    await Promise.allSettled(pending);
    await page.unroute(pattern).catch(() => {});
  }
});

test('keeps the form usable on small screens, zoom, keyboard and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLogin(page);
  const signIn = page.getByRole('button', kmuttSignIn);
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1440, 1000],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await signIn.scrollIntoViewIfNeeded();
    await expect(signIn).toBeInViewport();
  }
  await expect(
    page.getByRole('button', { name: 'หยุดภาพเคลื่อนไหว' }),
  ).toHaveCount(0);
  await page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(signIn).toBeFocused();
  await page.setViewportSize({ width: 720, height: 500 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    720,
  );
  await signIn.scrollIntoViewIfNeeded();
  await expect(signIn).toBeInViewport();
});

test('provides a JavaScript-disabled explanation instead of an unexplained intro', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.locator('noscript p:visible')).toBeVisible();
  await context.close();
});

test('passes automated WCAG A and AA checks on desktop and mobile', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLogin(page);
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});

test('receives an HttpOnly session from the password API in the isolated test database', async ({
  page,
  context,
}) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Real auth fixture requires the managed isolated test server',
  );
  await openLogin(page);
  await expect(page.getByRole('link', { name: 'ดูแผนที่บางมด' })).toHaveCount(
    0,
  );
  await authenticateBrowserAccount(page.request);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('[data-dashboard]')).toBeVisible();
  await expect(
    page.getByText(`สวัสดี, ${browserAccount.name}`, { exact: true }),
  ).toBeVisible();
  const profile = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/me');
    return { status: response.status, body: await response.json() };
  });
  expect(profile.status).toBe(200);
  expect(profile.body.data.email).toBe(browserAccount.email);
  const cookie = (await context.cookies()).find(
    (cookie) => cookie.name === 'browser_test_session',
  );
  expect(cookie).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  });
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'browser_test_session',
  );
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
  const navigation = await page.request.get('/map');
  expect(navigation.headers()['permissions-policy']).toContain(
    'geolocation=(self)',
  );
  const logout = await page.evaluate(
    async () => (await fetch('/api/v1/auth/logout', { method: 'POST' })).status,
  );
  expect(logout).toBe(200);
  const after = await page.evaluate(
    async () => (await fetch('/api/v1/auth/me')).status,
  );
  expect(after).toBe(401);
});
