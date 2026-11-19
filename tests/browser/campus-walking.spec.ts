import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import anchors from '../../apps/web/src/app/research/kmutt-bangmod/anchors.generated.json' with { type: 'json' };
import type { MapPoint } from '../../apps/web/src/app/research/kmutt-bangmod/walking';

const sharedWalk = '/research/kmutt-bangmod#from=N7&to=S3';
// Reviewed map-grid points on the N7 → S3 route and at the N10 approach.
const start: MapPoint = [124.84, -160.61];
const middle: MapPoint = [165.91, 53.22];
const destination: MapPoint = [143.77, 140.72];
const offRoute: MapPoint = [1.62, -100.47];

type GeoMock = {
  watches: number;
  clears: number;
  fix: (
    latitude: number,
    longitude: number,
    accuracy: number,
    age: number,
  ) => void;
  fail: (code: 1 | 2) => void;
};

declare global {
  interface Window {
    campusGeo: GeoMock;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let position: PositionCallback | null = null;
    let error: PositionErrorCallback | null = null;
    let timestamp = 0;
    const mock: GeoMock = {
      watches: 0,
      clears: 0,
      fix(latitude, longitude, accuracy, age) {
        timestamp = age
          ? Date.now() - age
          : Math.max(Date.now(), timestamp + 1);
        const coords = {
          latitude,
          longitude,
          accuracy,
          heading: 72,
          speed: 1,
          altitude: null,
          altitudeAccuracy: null,
          toJSON: () => ({}),
        };
        position?.({ timestamp, coords, toJSON: () => ({}) });
      },
      fail(code) {
        error?.({
          code,
          message: '',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      },
    };
    window.campusGeo = mock;
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition(
          success: PositionCallback,
          failure: PositionErrorCallback,
        ) {
          position = success;
          error = failure;
          return ++mock.watches;
        },
        clearWatch() {
          mock.clears++;
          position = null;
          error = null;
        },
      },
    });
  });
});

async function sendFix(page: Page, [x, z]: MapPoint, accuracy = 4, age = 0) {
  const { latitude, longitude, origin } = anchors.liveProjection;
  const determinant = longitude.x * latitude.z - latitude.x * longitude.z;
  await page.evaluate(
    ({ lat, lon, accuracy, age }) =>
      window.campusGeo.fix(lat, lon, accuracy, age),
    {
      lat: origin.lat + (longitude.x * z - longitude.z * x) / determinant,
      lon: origin.lon + (latitude.z * x - latitude.x * z) / determinant,
      accuracy,
      age,
    },
  );
}

test('opens a shared walk on desktop and keeps denial recoverable without losing the route', async ({
  page,
}, info) => {
  await page.goto(sharedWalk);
  const map = page.getByRole('region', { name: 'แผนที่วิทยาเขต' });
  const sidebar = page.getByRole('complementary', {
    name: 'การเดินในวิทยาเขต',
  });
  const mapBox = await map.boundingBox();
  const sidebarBox = await sidebar.boundingBox();
  if (!mapBox || !sidebarBox)
    throw new Error('Missing desktop map and sidebar');
  expect(sidebarBox.x).toBeGreaterThanOrEqual(mapBox.x + mapBox.width);
  await expect(sidebar.getByLabel('ต้นทาง')).toHaveValue('N7');
  await expect(
    sidebar.getByRole('combobox', { name: 'ปลายทาง', exact: true }),
  ).toHaveValue('S3');
  await expect(page.getByRole('button', { name: '3D แบบเบา' })).toBeEnabled();
  await expect
    .poll(() => page.evaluate(() => window.campusGeo.watches))
    .toBe(0);
  await page.screenshot({
    path: info.outputPath('desktop-route-planning.png'),
  });
  await page.getByRole('button', { name: '3D แบบเบา' }).click();
  await expect(map.locator('[data-render-state=ready]')).toBeVisible();
  await page.getByRole('button', { name: 'แผนที่ 2 มิติ' }).click();
  await sidebar.getByRole('button', { name: 'เริ่มเดิน' }).press('Enter');
  await expect(sidebar.getByRole('heading', { name: 'S3' })).toBeFocused();
  await page.evaluate(() => window.campusGeo.fail(1));
  await expect(sidebar.getByRole('status')).toContainText(
    'ยังไม่ได้รับสิทธิ์ตำแหน่ง',
  );
  await expect.poll(() => page.evaluate(() => window.campusGeo.clears)).toBe(1);
  await sidebar
    .getByRole('button', { name: 'ลองรับตำแหน่งอีกครั้ง' })
    .press('Enter');
  await page.evaluate(() => window.campusGeo.fail(2));
  await expect(sidebar.getByRole('status')).toContainText(
    'ยังรับตำแหน่งไม่ได้',
  );
  await sidebar.getByRole('button', { name: 'เลือกต้นทางใหม่' }).press('Enter');
  await expect(
    sidebar.getByRole('button', { name: 'เริ่มเดิน' }),
  ).toBeFocused();
  await sidebar.getByLabel('ต้นทาง').selectOption('N10');
  await sidebar.getByRole('searchbox', { name: 'ค้นหาปลายทาง' }).fill('s3');
  await sidebar.getByRole('button', { name: 'แสดงเส้นทางเดิน' }).click();
  await expect(page).toHaveURL(/#from=N10&to=S3$/);
  await expect
    .poll(() => page.evaluate(() => window.campusGeo.watches))
    .toBe(2);
});

test('follows a simulated N7 to S3 walk on mobile and detects arrival once', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(sharedWalk);
  const sidebar = page.getByRole('complementary', {
    name: 'การเดินในวิทยาเขต',
  });
  await sidebar.getByRole('button', { name: 'เริ่มเดิน' }).click();
  const map = page.getByRole('group', { name: 'แผนที่มุมสูง ทิศเหนือขึ้น' });
  const mapBox = await map.boundingBox();
  const sidebarBox = await sidebar.boundingBox();
  if (!mapBox || !sidebarBox) throw new Error('Missing mobile map and summary');
  expect(sidebarBox.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height);
  expect(sidebarBox.y + sidebarBox.height).toBeLessThanOrEqual(844);
  const follow = sidebar.getByRole('button', { name: 'ตามตำแหน่งฉัน' });
  await expect(follow).toBeDisabled();
  await sendFix(page, start);
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(follow).toBeEnabled();
  const target = await follow.boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(44);
  expect(target?.height).toBeGreaterThanOrEqual(44);
  await expect(sidebar).toContainText('359 ม.');
  await sendFix(page, middle);
  await expect(sidebar).toContainText('99 ม.');
  await expect(map.locator('[data-phase="completed"]')).not.toHaveCount(0);
  const marker = map.locator('[aria-label="ตำแหน่งของฉัน"]');
  const after = await marker.getAttribute('transform');
  await expect(marker).toHaveAttribute(
    'transform',
    /^translate\(165\.9\d* 53\.2\d*\)$/,
  );
  expect(after).toBe(await marker.getAttribute('transform'));
  await map.press('ArrowRight');
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  const manual = await map.getAttribute('viewBox');
  await sendFix(page, start);
  await expect(sidebar).toContainText('359 ม.');
  await expect(map).toHaveAttribute('viewBox', manual ?? '');
  await follow.press('Enter');
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  if (!box) throw new Error('Map is missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, {
    steps: 3,
  });
  await page.mouse.up();
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  await follow.press('Enter');
  await sendFix(page, middle);
  await expect(sidebar).toContainText('99 ม.');
  await page
    .getByRole('region', { name: 'แผนที่วิทยาเขต' })
    .evaluate((section) => section.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: info.outputPath('mobile-walking.png') });
  expect(
    (await new AxeBuilder({ page }).include('aside').analyze()).violations,
  ).toEqual([]);
  await sendFix(page, destination, 25.1);
  await expect(sidebar.getByRole('status')).toContainText(
    'สัญญาณ GPS ไม่แม่นยำ',
  );
  await expect(sidebar.getByText('—', { exact: true })).toHaveCount(2);
  await expect(marker).toHaveCount(0);
  await sendFix(page, destination);
  await expect(sidebar.getByRole('status')).toHaveText('ถึงบริเวณ S3 แล้ว');
  await page.screenshot({ path: info.outputPath('mobile-arrival.png') });
  await sendFix(page, start);
  await expect(sidebar.getByRole('status')).toHaveText('ถึงบริเวณ S3 แล้ว');
  await sidebar.getByRole('button', { name: 'จบการเดิน' }).click();
  await expect.poll(() => page.evaluate(() => window.campusGeo.clears)).toBe(1);
  await expect(page).toHaveURL(/#from=N7&to=S3$/);
});

test('reroutes after distinct fixes and stops tracking on pagehide', async ({
  page,
}) => {
  await page.goto(sharedWalk);
  const sidebar = page.getByRole('complementary', {
    name: 'การเดินในวิทยาเขต',
  });
  await sidebar.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await sendFix(page, start, 4, 30_001);
  await expect(sidebar.getByRole('status')).toContainText('ตำแหน่งหมดอายุ');
  await sendFix(page, offRoute);
  await expect(
    sidebar.getByText('ตำแหน่งอยู่นอกแนวเส้นทาง', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('เริ่มใหม่', { exact: true })).toHaveCount(0);
  await sendFix(page, offRoute);
  await sendFix(page, offRoute);
  await expect(page.getByText('เริ่มใหม่', { exact: true })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'S3' })).toBeVisible();
  await expect(page).toHaveURL(/#from=N7&to=S3$/);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  );
  await expect.poll(() => page.evaluate(() => window.campusGeo.clears)).toBe(1);
  await expect(
    sidebar.getByRole('button', { name: 'เริ่มเดิน' }),
  ).toBeVisible();
});

test('interpolates between two fixes and expires the marker without another GPS callback', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(sharedWalk);
  const sidebar = page.getByRole('complementary', {
    name: 'การเดินในวิทยาเขต',
  });
  await sidebar.getByRole('button', { name: 'เริ่มเดิน' }).click();
  const marker = page.locator('[aria-label="ตำแหน่งของฉัน"]');
  await sendFix(page, start);
  await expect(marker).toHaveAttribute('transform', /^translate/);
  const before = await marker.getAttribute('transform');
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 1_000)),
  );
  await sendFix(page, middle);
  await expect(sidebar).toContainText('99 ม.');
  await expect(marker).toHaveAttribute('transform', before ?? '');
  await page.clock.runFor(200);
  const during = await marker.getAttribute('transform');
  expect(during).not.toBe(before);
  await page.clock.runFor(300);
  await expect(marker).toHaveAttribute(
    'transform',
    /^translate\(165\.9\d* 53\.2\d*\)$/,
  );
  expect(await marker.getAttribute('transform')).not.toBe(during);
  await page.clock.fastForward(30_000);
  await expect(marker).toHaveCount(0);
  await expect(sidebar.getByRole('status')).toContainText('ตำแหน่งหมดอายุ');
});
