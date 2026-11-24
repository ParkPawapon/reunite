import { expect, test } from '@playwright/test';
import { isolatedServerDatabase } from './isolated-server-database';
import { browserAccount } from './test-account';

test('searches the full board while typing and lets an owner edit and close only their reports', async ({
  page,
}) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Requires the managed disposable report fixtures',
  );
  await page.goto('/reports/mine');
  await expect(page).toHaveURL(/\/login\?next=%2Freports%2Fmine$/);
  expect((await page.request.get('/api/v1/item-reports/me')).status()).toBe(
    401,
  );
  expect((await page.request.get('/api/v1/item-reports?q=%00')).status()).toBe(
    401,
  );
  const pool = await isolatedServerDatabase();
  const owner = 'my-reports-owner@example.test';
  const other = 'my-reports-other@example.test';
  const origin = 'http://localhost:3100';
  const title = 'ร่ม CampusTag %';
  const otherTitle = 'ร่ม CampusTag ของอีกบัญชี';
  const newTitle = 'ร่ม CampusTag แก้ไขแล้ว';
  const place = 'ชั้นล่างอาคารทดสอบ CampusTag';
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
    await pool.query('INSERT INTO locations (location_name) VALUES ($1)', [
      place,
    ]);
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
      (await page.request.get('/api/v1/item-reports?q=%00')).status(),
    ).toBe(422);
    expect(
      (await page.request.get('/api/v1/item-reports/me?q=%00')).status(),
    ).toBe(422);
    await page.goto('/dashboard');
    const statusFilter = page.getByLabel('สถานะประกาศ');
    await expect(statusFilter).toHaveValue('OPEN');
    await expect(
      page.getByRole('button', { name: 'ประกาศทดสอบหน้าแรก 11', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: title, exact: true }),
    ).toHaveCount(0);
    const search = page.getByRole('searchbox', { name: 'ค้นหาชื่อสิ่งของ' });
    await expect(
      page.getByRole('button', { name: 'ค้นหา', exact: true }),
    ).toHaveCount(0);
    await search.fill('  campustag %  ');
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
    await expect(statusFilter).toHaveValue('');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'หน้าถัดไป', exact: true }).click();
    await expect(page.getByLabel('หน้า 2', { exact: true })).toBeVisible();
    await search.fill('ร่ม');
    await expect(page.getByLabel('หน้า 1', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: otherTitle, exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: title, exact: true }).click();
    const dialog = page.getByRole('dialog');
    const footer = dialog.locator('footer');
    await expect(
      footer.getByRole('button', { name: 'แก้ไขรายการ', exact: true }),
    ).toBeVisible();
    await expect(
      footer.getByRole('button', { name: 'ปิดประกาศ', exact: true }),
    ).toBeVisible();
    await expect(
      footer.getByRole('button', { name: 'กลับไปดูรายการ', exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'แก้ไขรายการ' }).click();
    await expect(
      footer.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }),
    ).toBeVisible();
    await expect(
      footer.getByRole('button', { name: 'ยกเลิก', exact: true }),
    ).toBeVisible();
    const titleField = dialog.getByLabel('ชื่อสิ่งของ', { exact: true });
    await expect(titleField).toBeFocused();
    await titleField.fill(newTitle);
    const location = dialog.getByRole('combobox', { name: /สถานที่หาย/ });
    await location.fill('ชั้นล่างอาคารทดสอบ');
    await location.press('ArrowDown');
    await location.press('Enter');
    await expect(location).toHaveValue(place);
    await dialog.getByLabel('วันที่เกิดเหตุ').fill('2026-11-12');
    await dialog.getByLabel('เวลาเกิดเหตุ (เวลาไทย)').fill('13:42');
    await dialog.getByLabel('ลักษณะสิ่งของ').fill('ด้ามจับลายทาง');
    await dialog.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
    await expect(dialog.getByText('บันทึกการแก้ไขแล้ว')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: newTitle })).toBeVisible();
    await expect(dialog.getByText(place, { exact: true })).toBeVisible();
    await expect(
      dialog.locator('time[datetime="2026-11-12T06:42:00.000Z"]'),
    ).toContainText('13:42');
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
    await statusFilter.selectOption('OPEN');
    await expect(page.getByText('ไม่พบสิ่งของที่ค้นหา')).toBeVisible();
    await statusFilter.selectOption('CLOSED');
    await expect(
      page.getByRole('button', { name: newTitle, exact: true }),
    ).toBeVisible();
    await page.reload();
    await search.fill('CampusTag');
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

test('submits a private claim and shows the owner decision in report details', async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Requires managed disposable fixtures',
  );
  const pool = await isolatedServerDatabase();
  const title = 'กระเป๋าทดสอบคำร้อง ClaimTag';
  const owner = 'claim-browser-owner@example.test';
  const claimant = 'claim-browser-claimant@example.test';
  const peer = 'claim-browser-peer@example.test';
  const baseURL = 'http://localhost:3100';
  const claimantPage = await browser.newPage({ baseURL });
  const peerPage = await browser.newPage({ baseURL });
  async function login(target: typeof page, email: string) {
    const response = await target.request.post('/api/v1/auth/login', {
      headers: { origin: baseURL },
      data: { email, password: browserAccount.password },
    });
    expect(response.status()).toBe(200);
  }
  async function openReport(target: typeof page) {
    await target.goto('/dashboard');
    await expect(target.getByRole('tabpanel')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    const foundTab = target.getByRole('tab', { name: 'ของที่พบ' });
    await foundTab.click();
    await expect(foundTab).toHaveAttribute('aria-selected', 'true');
    const search = target.getByRole('searchbox', {
      name: 'ค้นหาชื่อสิ่งของ',
    });
    await search.fill('ClaimTag');
    await expect(search).toHaveValue('ClaimTag');
    await expect(target.getByText('ผลการค้นหา “ClaimTag”')).toBeVisible();
    await target.getByRole('button', { name: title, exact: true }).click();
    return target.getByRole('dialog');
  }
  try {
    await pool.query(
      `INSERT INTO users (name, email, password_hash)
       SELECT 'บัญชีทดสอบคำร้อง', fixture.email, u.password_hash
       FROM users u CROSS JOIN unnest($2::text[]) AS fixture(email)
       WHERE u.email = $1`,
      [browserAccount.email, [owner, claimant, peer]],
    );
    const {
      rows: [report],
    } = await pool.query<{ report_id: number }>(
      `INSERT INTO item_reports (user_id, category_id, location_id, type, title, event_datetime)
       SELECT user_id, 1, 1, 'FOUND', $2, NOW() FROM users WHERE email = $1 RETURNING report_id`,
      [owner, title],
    );
    if (!report) throw new Error('Missing report fixture');
    const claimsUrl = `/api/v1/item-reports/${report.report_id}/claims`;
    await Promise.all([
      login(page, owner),
      login(claimantPage, claimant),
      login(peerPage, peer),
    ]);
    const evidence = 'ด้านในมีรอยหมึกสีน้ำเงินสองจุด';
    const claimantDialog = await openReport(claimantPage);
    await claimantDialog
      .getByRole('button', { name: 'ขอรับของและดูคำร้อง' })
      .click();
    await claimantDialog.getByLabel('หลักฐานว่าเป็นของคุณ').fill(evidence);
    await claimantDialog
      .getByRole('button', { name: 'ส่งคำร้องขอรับของ' })
      .click();
    await expect(claimantDialog.getByText('ส่งคำร้องแล้ว')).toBeVisible();
    await expect(claimantDialog.getByText('รอตรวจสอบ')).toBeVisible();
    expect((await peerPage.request.get(claimsUrl)).status()).toBe(404);
    const peerDialog = await openReport(peerPage);
    await peerDialog
      .getByRole('button', { name: 'ขอรับของและดูคำร้อง' })
      .click();
    await expect(
      peerDialog.getByText('คุณยังไม่มีคำร้องสำหรับประกาศนี้'),
    ).toBeVisible();
    await expect(peerDialog.getByText(evidence, { exact: true })).toHaveCount(
      0,
    );
    await peerDialog
      .getByLabel('หลักฐานว่าเป็นของคุณ')
      .fill('รอยเย็บสีแดงที่มุมกระเป๋า');
    await peerDialog.getByRole('button', { name: 'ส่งคำร้องขอรับของ' }).click();
    await expect(peerDialog.getByText('รอตรวจสอบ')).toBeVisible();

    const ownerDialog = await openReport(page);
    await ownerDialog
      .getByRole('button', { name: 'คำร้องขอรับของ', exact: true })
      .click();
    const claim = ownerDialog
      .getByRole('listitem')
      .filter({ hasText: evidence });
    await claim.getByRole('button', { name: 'พิจารณาคำร้อง' }).click();
    await claim
      .getByLabel('ข้อความถึงผู้ยื่น (ไม่บังคับ)')
      .fill('ตรงกับรอยที่เห็นในกระเป๋า');
    await claim
      .getByRole('button', { name: 'อนุมัติคำร้อง', exact: true })
      .click();
    await expect(claim.getByText('อนุมัติแล้ว', { exact: true })).toBeVisible();
    const secondClaim = ownerDialog
      .getByRole('listitem')
      .filter({ hasText: 'รอยเย็บสีแดง' });
    await secondClaim.getByRole('button', { name: 'พิจารณาคำร้อง' }).click();
    await secondClaim
      .getByRole('button', { name: 'ไม่อนุมัติคำร้อง', exact: true })
      .click();
    await expect(
      secondClaim.getByText('ไม่อนุมัติ', { exact: true }),
    ).toBeVisible();
    await expect(
      ownerDialog.getByText('เปิดอยู่', { exact: true }),
    ).toBeVisible();

    const toggle = claimantDialog.getByRole('button', {
      name: 'ขอรับของและดูคำร้อง',
    });
    await toggle.click();
    await toggle.click();
    await expect(
      claimantDialog.getByText('อนุมัติแล้ว', { exact: true }),
    ).toBeVisible();
    await expect(
      claimantDialog.getByText(/ตรงกับรอยที่เห็นในกระเป๋า/),
    ).toBeVisible();
    await expect(
      claimantDialog.getByText('รอยเย็บสีแดงที่มุมกระเป๋า', { exact: true }),
    ).toHaveCount(0);
  } finally {
    await Promise.all([claimantPage.close(), peerPage.close(), pool.end()]);
  }
});
