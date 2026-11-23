import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { isolatedServerDatabase } from './isolated-server-database';

test('requires a Microsoft-linked user to finish setup before using the app', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Requires the managed disposable database',
  );
  const pool = await isolatedServerDatabase();
  const token = randomBytes(32).toString('base64url');
  const objectId = randomUUID();
  try {
    await pool.query(
      `WITH account AS (
        INSERT INTO users (name, email, microsoft_tenant_id, microsoft_object_id, first_name, last_name)
        VALUES ('new-member', $1, $2, $3, 'ทดสอบ', 'บัญชีมหาวิทยาลัย') RETURNING user_id
      )
      INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      SELECT user_id, $4, CURRENT_TIMESTAMP + INTERVAL '1 day' FROM account`,
      [
        `${objectId}@kmutt.ac.th`,
        randomUUID(),
        objectId,
        createHash('sha256').update(token).digest('hex'),
      ],
    );
    await page.goto('/complete-profile');
    await expect(page).toHaveURL(/\/login$/);
    await context.addCookies([
      { name: 'browser_test_session', value: token, url: baseURL },
    ]);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/complete-profile$/);
    await expect(
      page.getByRole('heading', { name: 'ตั้งค่าโปรไฟล์' }),
    ).toBeVisible();
    expect((await page.request.get('/api/v1/item-reports')).status()).toBe(403);

    await expect(page.getByLabel('ชื่อจริง')).toHaveValue('ทดสอบ');
    await expect(page.getByLabel('รหัสนักศึกษา')).toHaveCount(0);
    await expect(page.getByLabel('นามสกุล')).toHaveValue('บัญชีมหาวิทยาลัย');
    await page.getByRole('button', { name: 'บันทึกและไปหน้าภาพรวม' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect((await page.request.get('/api/v1/item-reports')).status()).toBe(200);
    expect(
      await (await page.request.get('/api/v1/profile')).json(),
    ).toMatchObject({
      data: {
        firstName: 'ทดสอบ',
        lastName: 'บัญชีมหาวิทยาลัย',
        studentId: null,
      },
    });
    await page.goto('/complete-profile');
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    await pool.end();
  }
});
