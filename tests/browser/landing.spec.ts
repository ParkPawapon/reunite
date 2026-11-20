import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('renders the story, credits and real destinations without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL('/landing', baseURL).href);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'ของหาย ยังมีทางกลับ',
    );
    await expect(page.locator('[data-landing-stage]')).toHaveAttribute(
      'data-landing-stage',
      'poster',
    );
    await expect(
      page.getByRole('link', { name: 'เปิดแผนที่บางมด' }),
    ).toHaveAttribute('href', '/map#from=N7&to=S3');
    const credit = page.getByRole('link', {
      name: 'ที่มาข้อมูลแผนที่และโมเดล',
    });
    const notice = '/research/kmutt-bangmod/NOTICE.txt';
    await expect(credit).toHaveAttribute('href', notice);
    expect((await page.request.get(new URL(notice, baseURL).href)).ok()).toBe(
      true,
    );
    await expect(
      page.getByRole('article', { name: 'ร่มพับสีน้ำเงิน' }),
    ).toContainText('หน้าอาคาร S3');
    await expect(page.getByText('ประมาณ 359 ม.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'ร่มได้กลับไปหาเจ้าของ' }),
    ).toBeVisible();
    for (const name of ['ParkPawapon', 'milky-way-miw', 'Ch3323']) {
      await expect(
        page.getByRole('link', { name: `${name} GitHub` }),
      ).toHaveAttribute('href', `https://github.com/${name}`);
    }
    await expect(
      page.getByRole('link', { name: 'เข้าสู่ระบบ' }).first(),
    ).toHaveAttribute('href', '/login');
  } finally {
    await context.close();
  }
});

test('runs the local 3D stage, focus controls, Parallax and the motion switch', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/landing');
  const stage = page.locator('[data-landing-stage]');
  await expect(stage).toHaveAttribute('data-landing-stage', 'ready');
  const scout = page.getByRole('button', { name: 'ห่านสำรวจ', exact: true });
  await scout.click();
  await expect(scout).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'ทั้งทีม', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  const scene = page.getByRole('region', { name: 'ร่มได้กลับไปหาเจ้าของ' });
  await scene.evaluate((region) =>
    window.scrollTo(
      0,
      region.getBoundingClientRect().top + window.scrollY - 90,
    ),
  );
  const parallax = () =>
    scene
      .locator('[data-parallax]')
      .evaluateAll((layers) =>
        layers.map((layer) =>
          Number.parseFloat(
            (layer as HTMLElement).style.getPropertyValue('--parallax-y'),
          ),
        ),
      );
  await expect
    .poll(async () => {
      const [background, character] = await parallax();
      return (background ?? 0) * (character ?? 0);
    })
    .toBeLessThan(0);
  await page.getByRole('button', { name: 'หยุดภาพเคลื่อนไหว' }).click();
  await expect(page.locator('[data-landing-motion]')).toHaveAttribute(
    'data-landing-motion',
    'still',
  );
  expect(errors).toEqual([]);
});

test('uses scroll to follow the umbrella, build the report, and draw its walking route', async ({
  page,
}) => {
  await page.goto('/landing');
  const stage = page.locator('[data-landing-stage]');
  await expect(stage).toHaveAttribute('data-landing-stage', 'ready');
  await expect(stage).toHaveAttribute('data-clue-progress', '0.000');
  await page.evaluate(() => window.scrollTo(0, 405));
  await expect
    .poll(async () => Number(await stage.getAttribute('data-clue-progress')))
    .toBeGreaterThan(0.4);

  const report = page.locator('[data-report-story]');
  const locateReport = (offset: number) =>
    report.evaluate((node, offset) => {
      window.scrollTo(
        0,
        node.getBoundingClientRect().top + window.scrollY + offset,
      );
    }, offset);
  const title = page.getByRole('heading', { name: 'ร่มพับสีน้ำเงิน' });
  await locateReport(-215);
  await expect(title).toHaveCSS('opacity', '0');
  await locateReport(420);
  await expect(title).toHaveCSS('opacity', '1');
  await expect(report.locator('dl')).toHaveCSS('opacity', '1');
  await expect(report.locator('[data-attachment] img')).toHaveAttribute(
    'src',
    /umbrella-attachment\.webp/,
  );

  const route = page.locator('[data-route-map]');
  const line = route.locator('[data-walk-line]');
  const locateMap = (offset: number) =>
    route.evaluate((node, offset) => {
      window.scrollTo(
        0,
        node.getBoundingClientRect().top + window.scrollY + offset,
      );
    }, offset);
  await locateMap(-900);
  await expect(line).toHaveCSS('stroke-dashoffset', '1px');
  await locateMap(-95);
  await expect(line).toHaveCSS('stroke-dashoffset', '0px');
  await expect(
    page.locator('[data-route-story] [data-scene-image]'),
  ).toHaveAttribute('data-scene-image', 'ready');
  await expect(
    page.getByRole('img', { name: /ส่งร่มพับสีน้ำเงินคืน/ }),
  ).toBeVisible();
});

test('ties scene animation to actual asset loading and falls back gracefully', async ({
  page,
}) => {
  let finishPhoto = () => {};
  const photoRequested = new Promise<void>((resolve) => {
    finishPhoto = resolve;
  });
  let failModel = () => {};
  const modelRequested = new Promise<void>((resolve) => {
    failModel = resolve;
  });
  await page.route('**/landing/finding-party.glb', async (route) => {
    await modelRequested;
    return route.abort();
  });
  await page.route('**/_next/image?*', async (route) => {
    const url = new URL(route.request().url());
    const resource = new URL(url.searchParams.get('url') ?? '/', url).pathname;
    if (resource === '/landing/umbrella-attachment.webp') await photoRequested;
    if (resource === '/landing/umbrella-return-courtyard.webp')
      return route.abort();
    return route.continue();
  });
  const stage = page.locator('[data-landing-stage]');
  const first = page.getByRole('article', { name: 'ร่มพับสีน้ำเงิน' });
  try {
    await page.goto('/landing', { waitUntil: 'domcontentloaded' });
    await expect(stage).toHaveAttribute('data-landing-stage', 'loading');
    await expect(stage.locator('span')).toHaveCSS(
      'animation-name',
      /scene-loading/,
    );
    failModel();
    await expect(stage).toHaveAttribute('data-landing-stage', 'poster');

    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute('data-scene-visible', 'true');
    await expect(first.locator('[data-scene-image]')).toHaveAttribute(
      'data-scene-image',
      'loading',
    );
    await expect(first.locator('[data-scene-image] > span')).toHaveCSS(
      'animation-name',
      /scene-loading/,
    );
  } finally {
    finishPhoto();
    failModel();
  }
  await expect(first.locator('[data-scene-image]')).toHaveAttribute(
    'data-scene-image',
    'ready',
  );
  const second = page.getByRole('region', { name: 'ร่มได้กลับไปหาเจ้าของ' });
  await second.scrollIntoViewIfNeeded();
  await expect(second.locator('[data-scene-image="unavailable"]')).toHaveCount(
    1,
  );
  await expect(
    page.getByRole('heading', { name: 'ร่มได้กลับไปหาเจ้าของ' }),
  ).toBeVisible();
});

test('uses the portrait fallback with reduced motion and fits narrow screens', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const modelRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/landing/finding-party.glb'))
      modelRequests.push(request.url());
  });
  await page.goto('/landing');
  await page.getByRole('button', { name: 'Agent Honk', exact: true }).click();
  await expect(
    page.getByRole('img', {
      name: 'ห่านนักสืบสวมเสื้อโค้ตและถือกล้องส่องทางไกล',
    }),
  ).toBeVisible();
  await expect(page.locator('[data-landing-stage]')).toHaveAttribute(
    'data-landing-stage',
    'poster',
  );
  expect(modelRequests).toEqual([]);
  await expect(page.locator('[data-landing-scroll]')).toHaveAttribute(
    'data-landing-scroll',
    'static',
  );
  await expect(page.locator('[data-walk-line]')).toHaveCSS(
    'stroke-dashoffset',
    '0px',
  );
  await expect(
    page.getByRole('heading', { name: 'ร่มพับสีน้ำเงิน' }),
  ).toHaveCSS('opacity', '1');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    const bounds = await page.locator('[data-landing-stage]').boundingBox();
    const controls = await page
      .getByRole('group', { name: 'เลือกดูตัวละคร' })
      .boundingBox();
    expect(controls?.y ?? 0).toBeGreaterThan(
      bounds ? bounds.y + bounds.height : 0,
    );
  }
  const results = await new AxeBuilder({ page })
    .exclude('nextjs-portal')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
