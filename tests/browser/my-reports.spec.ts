import { expect, test } from '@playwright/test';
import { isolatedServerDatabase } from './isolated-server-database';
import { browserAccount } from './test-account';

test('searches the full board and lets an owner edit and close only their reports', async ({
  page,
}) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Requires the managed disposable report fixtures',
  );
  await page.goto('/reports/mine');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/item-reports/me')).status()).toBe(
    401,
  );
  expect((await page.request.get('/api/v1/item-reports?q=%00')).status()).toBe(
    422,
  );
  const pool = await isolatedServerDatabase();
  const owner = 'my-reports-owner@example.test';
  const other = 'my-reports-other@example.test';
  const origin = 'http://localhost:3100';
  const title = 'ร่ม CampusTag %';
  const otherTitle = 'ร่ม CampusTag ของอีกบัญชี';
  const newTitle = 'ร่ม CampusTag แก้ไขแล้ว';
  try {
    await pool.query(
      `INSERT INTO users (name, email, password_hash)
       SELECT 'บัญชีทดสอบรายการ', fixture.email, u.password_hash
       FROM users u CROSS JOIN (VALUES ($2::text), ($3::text)) AS fixture(email)
       WHERE u.email = $1`,
      [browserAccount.email, owner, other],
    );
    await pool.query(
      `INSERT INTO item_reports (user_id, category_id, location_id, type, title, event_datetime)
       SELECT user_id, 1, 1, 'LOST', $2, NOW() FROM users WHERE email = $1`,
      [owner, title],
    );
    const {
      rows: [foreign],
    } = await pool.query<{ report_id: number }>(
      `INSERT INTO item_reports (user_id, category_id, location_id, type, title, event_datetime)
       SELECT user_id, 1, 1, 'LOST', $2, NOW() FROM users WHERE email = $1 RETURNING report_id`,
      [other, otherTitle],
    );
    if (!foreign) throw new Error('Missing foreign report fixture');
    await pool.query(
      `INSERT INTO item_reports (user_id, category_id, location_id, type, title, event_datetime)
       SELECT user_id, 1, 1, 'LOST', 'ประกาศทดสอบหน้าแรก ' || series, NOW()
       FROM users CROSS JOIN generate_series(1, 11) AS series WHERE email = $1`,
      [owner],
    );
    const login = await page.request.post('/api/v1/auth/login', {
      headers: { origin },
      data: { email: owner, password: browserAccount.password },
    });
    expect(login.status()).toBe(200);
    expect(
      (await page.request.get('/api/v1/item-reports/me?q=%00')).status(),
    ).toBe(422);
    await page.goto('/dashboard');
    await expect(
      page.getByRole('button', { name: 'ประกาศทดสอบหน้าแรก 11', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: title, exact: true }),
    ).toHaveCount(0);
    const search = page.getByRole('searchbox', { name: 'ค้นหาชื่อสิ่งของ' });
    await search.fill('  campustag %  ');
    await search.press('Enter');
    await expect(
      page.getByRole('button', { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-report-id]')).toHaveCount(1);
    await page.getByRole('tab', { name: 'ของที่พบ' }).click();
    await expect(page.getByText('ไม่พบสิ่งของที่ค้นหา')).toBeVisible();
    await page.getByRole('tab', { name: 'ของหาย', exact: true }).click();
    await expect(
      page.getByRole('button', { name: title, exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'ล้างการค้นหา' }).click();
    await expect(search).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'ประกาศทดสอบหน้าแรก 11', exact: true }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'รายการของฉัน', exact: true }).click();
    await expect(page).toHaveURL(/\/reports\/mine$/);
    await expect(
      page.getByRole('heading', { name: 'รายการของฉัน' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await search.fill('CampusTag');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await expect(
      page.getByRole('button', { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: otherTitle, exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: title, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'แก้ไขรายการ' }).click();
    const titleField = dialog.getByLabel('ชื่อสิ่งของ', { exact: true });
    await expect(titleField).toBeFocused();
    await titleField.fill(newTitle);
    await dialog.getByLabel('ลักษณะสิ่งของ').fill('ด้ามจับลายทาง');
    await dialog.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
    await expect(dialog.getByText('บันทึกการแก้ไขแล้ว')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: newTitle })).toBeVisible();
    await dialog
      .getByRole('button', { name: 'ปิดประกาศ', exact: true })
      .click();
    await expect(
      dialog.getByRole('heading', { name: 'ยืนยันการปิดประกาศ' }),
    ).toBeFocused();
    await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    await expect(dialog.getByText('เปิดอยู่', { exact: true })).toBeVisible();
    await dialog
      .getByRole('button', { name: 'ปิดประกาศ', exact: true })
      .click();
    await dialog.getByRole('button', { name: 'ยืนยันปิดประกาศ' }).click();
    await expect(
      dialog.getByText('ปิดประกาศแล้ว', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'ปิดรายละเอียด' }).click();
    await expect(
      page.locator('[data-report-id]').filter({ hasText: newTitle }),
    ).toContainText('ปิดแล้ว');
    await page.reload();
    await search.fill('CampusTag');
    await search.press('Enter');
    await expect(
      page.locator('[data-report-id]').filter({ hasText: newTitle }),
    ).toContainText('ปิดแล้ว');
    const foreignEdit = await page.request.patch(
      `/api/v1/item-reports/${foreign.report_id}`,
      {
        headers: { origin },
        data: { title: 'forbidden edit' },
      },
    );
    const foreignClose = await page.request.patch(
      `/api/v1/item-reports/${foreign.report_id}/status`,
      {
        headers: { origin },
        data: { status: 'CLOSED' },
      },
    );
    expect(foreignEdit.status()).toBe(404);
    expect(foreignClose.status()).toBe(404);
  } finally {
    await pool.end();
  }
});
