import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { browserAccount } from './test-account';

async function openLogin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true }),
  ).toBeVisible();
}

test('opens the root with a two-second intro before revealing the login form', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const observe = () => {
      if (
        document.querySelector('[data-login-intro] [data-animation=running]') &&
        !performance.getEntriesByName('intro-interactive').length
      )
        performance.mark('intro-interactive');
      if (
        document.querySelector('[data-login-screen]') &&
        !performance.getEntriesByName('login-visible').length
      )
        performance.mark('login-visible');
    };
    new MutationObserver(observe).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('[data-login-intro]')).toBeVisible();
  await expect(
    page.locator('[data-login-intro] [data-animation=running]:visible'),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-login-screen]')).toHaveCount(0);
  await expect(page.locator('[data-login-screen]')).toBeVisible();
  const elapsed = await page.evaluate(
    () =>
      performance.measure(
        'intro-duration',
        'intro-interactive',
        'login-visible',
      ).duration,
  );
  expect(elapsed).toBeGreaterThanOrEqual(1900);
  expect(elapsed).toBeLessThan(5000);
  await expect(
    page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true }),
  ).toBeFocused();
  for (const text of ['Email', 'Password', 'ใช้บัญชีที่ได้รับจากผู้ดูแลระบบ'])
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('validates locally, supports password visibility and closes the goose eye', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/v1/auth/login', (route) => {
    calls++;
    return route.fulfill({ status: 401, json: {} });
  });
  await openLogin(page);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByLabel('อีเมล')).toBeFocused();
  await expect(page.getByLabel('อีเมล')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(calls).toBe(0);
  await page.getByLabel('อีเมล').fill('hello@example.test');
  await page
    .getByLabel('รหัสผ่าน', { exact: true })
    .fill('spaces are preserved ');
  await expect(page.locator('[data-goose-animation]')).toHaveAttribute(
    'data-private',
    'true',
  );
  await expect(page.locator('[data-goose-animation]')).toHaveAttribute(
    'data-goose-animation',
    'still',
  );
  await page.getByRole('button', { name: 'แสดงรหัสผ่าน', exact: true }).click();
  await expect(page.getByLabel('รหัสผ่าน', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'ซ่อนรหัสผ่าน' }).click();
  await expect(page.getByLabel('รหัสผ่าน', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
});

test('normalizes only email, prevents duplicate requests and recovers from API errors', async ({
  page,
}) => {
  let calls = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/auth/login', async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      email: 'hello@example.test',
      password: ' keep spaces ',
    });
    await gate;
    return route.fulfill({
      status: 401,
      json: { error: { message: 'Untrusted backend detail' } },
    });
  });
  await openLogin(page);
  await page.getByLabel('อีเมล').fill('HELLO@EXAMPLE.TEST');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(' keep spaces ');
  const submit = page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true });
  await submit.click();
  await expect(
    page.getByRole('button', { name: 'กำลังเข้าสู่ระบบ…', exact: true }),
  ).toBeDisabled();
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  release();
  await expect(page.locator('form').getByRole('alert')).toContainText(
    'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  );
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  expect(calls).toBe(1);
  await expect(page.getByText('Untrusted backend detail')).toHaveCount(0);
  for (const [status, message] of [
    [429, '15 นาที'],
    [503, 'ในภายหลัง'],
    [200, 'ไม่สามารถยืนยัน'],
  ] as const) {
    await page.unroute('**/api/v1/auth/login');
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({ status, json: { data: {} } }),
    );
    await submit.click();
    await expect(page.locator('form').getByRole('alert')).toContainText(
      message,
    );
    await expect(submit).toBeEnabled();
  }
  await page.unroute('**/api/v1/auth/login');
  await page.route('**/api/v1/auth/login', (route) => route.abort());
  await submit.click();
  await expect(page.locator('form').getByRole('alert')).toContainText(
    'เชื่อมต่อไม่สำเร็จ',
  );
  await expect(submit).toBeEnabled();
});

test('keeps the form usable on small screens, zoom, keyboard and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLogin(page);
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
    await expect(page.getByLabel('อีเมล')).toBeVisible();
    await page
      .getByRole('button', { name: 'เข้าสู่ระบบ', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }),
    ).toBeInViewport();
  }
  await expect(
    page.getByRole('button', { name: 'หยุดภาพเคลื่อนไหว' }),
  ).toHaveCount(0);
  await page.getByLabel('อีเมล').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('รหัสผ่าน', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'แสดงรหัสผ่าน', exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 720, height: 500 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    720,
  );
  await page.getByLabel('อีเมล').scrollIntoViewIfNeeded();
  await expect(page.getByLabel('อีเมล')).toBeInViewport();
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

test('times out a stalled login request and allows a retry', async ({
  page,
}) => {
  await openLogin(page);
  await page.route('**/api/v1/auth/login', () => {});
  await page.getByLabel('อีเมล').fill('timeout@example.test');
  await page
    .getByLabel('รหัสผ่าน', { exact: true })
    .fill('not a real credential');
  await page.clock.install();
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await page.clock.fastForward(15_001);
  await expect(page.locator('form').getByRole('alert')).toContainText(
    'เชื่อมต่อไม่สำเร็จ',
  );
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }),
  ).toBeEnabled();
});

test('passes automated WCAG A and AA checks on desktop, mobile and invalid form states', async ({
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
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});

test('logs in through the real API and receives an HttpOnly session in the isolated test database', async ({
  page,
  context,
}) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Real auth fixture requires the managed isolated test server',
  );
  await openLogin(page);
  await page.getByLabel('อีเมล').fill(browserAccount.email);
  await page
    .getByLabel('รหัสผ่าน', { exact: true })
    .fill(browserAccount.password);
  const response = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/auth/login'),
  );
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/research\/kmutt-bangmod$/);
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
  const navigation = await page.request.get('/research/kmutt-bangmod');
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
