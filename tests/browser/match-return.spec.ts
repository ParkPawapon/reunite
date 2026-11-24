import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { isolatedServerDatabase } from './isolated-server-database';
import { browserAccount } from './test-account';

test('opens the match from alerts in one dialog and completes the return on two devices', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90_000);
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Uses the managed disposable schema',
  );
  const pool = await isolatedServerDatabase();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const ownerEmail = 'match-owner@example.test';
  const finderEmail = 'match-finder@example.test';
  const finder = await phone.newPage();
  try {
    await pool.query(
      `INSERT INTO users(name,email,password_hash)
       SELECT label,profiles.email,password_hash FROM users CROSS JOIN
        (VALUES ('เจ้าของร่มทดสอบ',$2::text),('ผู้พบร่มทดสอบ',$3::text)) AS profiles(label,email)
        WHERE users.email=$1`,
      [browserAccount.email, ownerEmail, finderEmail],
    );
    for (const [person, email] of [
      [page, ownerEmail],
      [finder, finderEmail],
    ] as const) {
      const login = await person.request.post(
        'http://localhost:3100/api/v1/auth/login',
        {
          headers: { origin: 'http://localhost:3100' },
          data: { email, password: browserAccount.password },
        },
      );
      expect(login.status()).toBe(200);
    }
    const initial = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/notifications') &&
        response.request().method() === 'GET',
    );
    await page.goto('/dashboard');
    await initial;
    const photo = await readFile(
      new URL(
        '../../apps/web/public/landing/umbrella-attachment.webp',
        import.meta.url,
      ),
    );
    const reports = await pool.query<{ report_id: number; type: string }>(
      `INSERT INTO item_reports(user_id,category_id,location_id,type,title,description,event_datetime,image_data)
      SELECT user_id,1,1,CASE WHEN email=$1 THEN 'LOST' ELSE 'FOUND' END,
       'ร่มพับสีน้ำเงิน', 'มีสายรัดสีฟ้า', CURRENT_TIMESTAMP,
       CASE WHEN email=$2 THEN $3::bytea ELSE NULL END
      FROM users WHERE email IN ($1,$2) RETURNING report_id,type`,
      [ownerEmail, finderEmail, photo],
    );
    const lost = reports.rows.find((row) => row.type === 'LOST')?.report_id;
    const found = reports.rows.find((row) => row.type === 'FOUND')?.report_id;
    if (!lost || !found) throw new Error('Missing match report fixtures');
    const assessment = {
      decision: 'possible_match',
      summary: 'มีลักษณะตรงกัน',
      evidence: [],
      missingEvidence: [],
      imageComparison: 'one',
    };
    const match = await pool.query<{ match_id: number }>(
      `WITH published AS (
        UPDATE report_matches SET state='complete',result=$3,notified=true,completed_at=NOW()
        WHERE lost_report_id=$1 AND found_report_id=$2 RETURNING match_id
      ), alerted AS (
        INSERT INTO notifications(user_id,kind,match_id)
        SELECT r.user_id,'MATCH_SUGGESTED',p.match_id FROM published p
        CROSS JOIN item_reports r WHERE r.report_id IN ($1,$2)
      ) SELECT match_id FROM published`,
      [lost, found, assessment],
    );
    const matchId = match.rows[0]?.match_id;
    expect(matchId).toBeTruthy();
    await page.getByRole('button', { name: 'ดูคู่สิ่งของ' }).click();
    const review = page.getByRole('dialog', { name: 'ของสองชิ้นนี้อาจตรงกัน' });
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(review).toHaveAttribute('aria-modal', 'true');
    const scene = review.locator('[data-match-scene="suggested"]');
    await expect(scene).toHaveAttribute('data-motion', 'on');
    const reveal = await scene.evaluate((element) => {
      const delays = Object.fromEntries(
        Array.from(
          element.querySelectorAll<HTMLElement>('[data-match-effect]'),
        ).map((part) => [
          part.dataset.matchEffect,
          part.getAnimations()[0]?.effect?.getTiming().delay,
        ]),
      );
      return {
        delays,
        animated: element.getAnimations({ subtree: true }).length,
      };
    });
    expect(reveal.animated).toBeGreaterThanOrEqual(6);
    expect(reveal.delays.found).toBeGreaterThan(reveal.delays.lost ?? 0);
    expect(reveal.delays.seal).toBeGreaterThan(reveal.delays.signal ?? 0);
    const entryDelays = await review
      .locator('article, [data-match-join]')
      .evaluateAll((parts) =>
        parts.map(
          (part) => part.getAnimations()[0]?.effect?.getTiming().delay ?? -1,
        ),
      );
    expect(entryDelays).toHaveLength(3);
    expect(entryDelays[1]).toBeGreaterThan(entryDelays[0] ?? 0);
    expect(entryDelays[2]).toBeGreaterThan(entryDelays[1] ?? 0);
    await expect(
      page.getByRole('heading', { name: 'ของสองชิ้นนี้อาจตรงกัน' }),
    ).toBeFocused();
    await expect(
      review.getByRole('region', { name: 'ผลการเทียบภาพและข้อความ' }),
    ).toBeVisible();
    await expect(review.getByText('ข้อความที่พิมพ์')).toBeVisible();
    await expect(page.getByText('ไม่มีรูปแนบ')).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole('img', { name: 'รูปร่มพับสีน้ำเงิน' })
          .evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(page.locator('[data-stage="review"]')).toHaveAttribute(
      'data-motion',
      'on',
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const photoHeights = await page
      .locator('[data-match-photo]')
      .evaluateAll((photos) =>
        photos.map((photo) => photo.getBoundingClientRect().height),
      );
    expect(photoHeights).toHaveLength(2);
    expect(photoHeights[0]).toBeCloseTo(photoHeights[1] ?? 0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#match-return-dialog')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath('desktop-match-review.png'),
    });
    await page.keyboard.press('Shift+Tab');
    await expect
      .poll(() =>
        review.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(review).toHaveCount(0);
    const ownerBell = page.getByRole('button', { name: /การแจ้งเตือน/ });
    await expect(ownerBell).toBeFocused();
    await ownerBell.press('Enter');
    await page
      .getByRole('dialog', { name: 'การแจ้งเตือน' })
      .getByRole('button', { name: 'ของสองชิ้นนี้อาจตรงกัน' })
      .click();
    await expect(review).toBeVisible();
    await page.getByRole('button', { name: 'ไปที่การคืนของ' }).click();
    await page.getByRole('button', { name: 'ได้รับของแล้ว' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยัน', exact: true })
      .click();
    await expect(page.getByText('คุณยืนยันแล้ว กำลังรออีกฝ่าย')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'ยืนยันการคืนของ' }),
    ).toBeFocused();
    expect(
      (
        await pool.query(
          "SELECT count(*)::int FROM item_reports WHERE report_id IN ($1,$2) AND status='OPEN'",
          [lost, found],
        )
      ).rows[0].count,
    ).toBe(2);

    await finder.goto('http://localhost:3100/dashboard');
    await finder.getByRole('button', { name: /การแจ้งเตือน/ }).click();
    const bell = finder.getByRole('dialog', { name: 'การแจ้งเตือน' });
    await bell
      .getByRole('button', { name: 'อีกฝ่ายยืนยันการคืนของแล้ว' })
      .click();
    await expect(finder).toHaveURL(/\/dashboard$/);
    await finder.setViewportSize({ width: 320, height: 568 });
    const mobileDialog = finder.getByRole('dialog', {
      name: 'ของสองชิ้นนี้อาจตรงกัน',
    });
    const mobileScene = mobileDialog.locator('[data-match-scene="suggested"]');
    await expect(mobileScene).toHaveAttribute('data-motion', 'off');
    expect(
      await mobileScene.evaluate(
        (element) => element.getAnimations({ subtree: true }).length,
      ),
    ).toBe(0);
    expect(
      await mobileDialog
        .locator('article, [data-match-join]')
        .evaluateAll(
          (parts) =>
            parts.flatMap((part) => part.getAnimations({ subtree: true }))
              .length,
        ),
    ).toBe(0);
    await expect(
      mobileDialog.getByRole('button', { name: 'ไปที่การคืนของ' }),
    ).toBeInViewport();
    const bounds = await mobileDialog.boundingBox();
    expect(bounds?.width).toBeCloseTo(320);
    await finder.getByRole('button', { name: 'ไปที่การคืนของ' }).click();
    await expect(
      finder.getByText('ได้รับของแล้ว', { exact: true }),
    ).toBeVisible();
    await finder
      .getByRole('button', { name: 'คืนของแล้ว', exact: true })
      .click();
    await finder
      .getByRole('dialog')
      .getByRole('button', { name: 'ยืนยัน', exact: true })
      .click();
    await finder.setViewportSize({ width: 390, height: 844 });
    await expect(
      finder.getByRole('heading', { name: 'ของกลับถึงมือเจ้าของแล้ว' }),
    ).toBeFocused();
    await expect(finder.locator('[data-stage="complete"]')).toHaveAttribute(
      'data-motion',
      'off',
    );
    await expect(finder.locator('[data-match-scene="returned"]')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'ของกลับถึงมือเจ้าของแล้ว' }),
    ).toBeVisible({ timeout: 18000 });
    expect(
      await finder.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    expect(
      (
        await new AxeBuilder({ page: finder })
          .include('#match-return-dialog')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await finder.screenshot({
      path: info.outputPath('mobile-return-complete.png'),
    });
    await expect(
      finder.getByRole('button', { name: 'คืนของแล้ว', exact: true }),
    ).toHaveCount(0);
    await finder.getByRole('button', { name: 'เรียบร้อย' }).click();
    await expect(finder.getByRole('dialog')).toHaveCount(0);
    await expect(
      finder.getByRole('button', { name: /การแจ้งเตือน/ }),
    ).toBeFocused();
    await finder.goto(`http://localhost:3100/matches/${matchId}`);
    await expect(
      finder.getByRole('dialog', { name: 'ของกลับถึงมือเจ้าของแล้ว' }),
    ).toBeVisible();
    await finder
      .getByRole('button', { name: 'ปิดหน้าต่างจับคู่สิ่งของ' })
      .click();
    await expect(finder).toHaveURL(/\/matches$/);
  } finally {
    await phone.close();
    await pool.end();
  }
});
