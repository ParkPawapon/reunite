import { test, expect } from '@playwright/test';
import { browserAccount } from './test-account';
import { isolatedServerDatabase } from './isolated-server-database';

test('shows an accurate profile skeleton during real data latency and recovers from a real server failure', async ({
  page,
}) => {
  test.skip(
    !!process.env.PLAYWRIGHT_BASE_URL,
    'Uses the managed disposable schema',
  );
  const pool = await isolatedServerDatabase();
  let slow = false;
  let failed = false;
  try {
    const login = await page.request.post('/api/v1/auth/login', {
      headers: { origin: 'http://localhost:3100' },
      data: { email: browserAccount.email, password: browserAccount.password },
    });
    expect(login.status()).toBe(200);
    await page.goto('/dashboard');
    await expect(page.locator('[data-dashboard]')).toBeVisible();
    await pool.query('ALTER TABLE users RENAME TO users_loading_fixture');
    slow = true;
    await pool.query(
      `CREATE VIEW users AS SELECT u.* FROM users_loading_fixture u CROSS JOIN LATERAL (SELECT pg_sleep(1.2) WHERE u.user_id>0) delay`,
    );
    await page
      .getByRole('link', { name: 'โปรไฟล์ของฉัน', exact: true })
      .click();
    await expect(page.locator('[data-profile-skeleton]')).toBeVisible();
    expect(await page.locator('[data-profile-skeleton-field]').count()).toBe(8);
    await page.screenshot({
      path: 'tmp/profile/route-skeleton.png',
      fullPage: true,
    });
    await expect(page.locator('[data-profile]')).toBeVisible();
    await expect(page.locator('[data-profile-skeleton]')).toHaveCount(0);
    await pool.query('DROP VIEW users');
    await pool.query('ALTER TABLE users_loading_fixture RENAME TO users');
    slow = false;
    await pool.query('ALTER TABLE users RENAME TO users_failure_fixture');
    failed = true;
    await page.reload();
    await expect(page.locator('[data-status-page="500"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'เบาะแสพันกันนิดหน่อย',
    );
    await expect(page.locator('body')).not.toContainText(
      'users_failure_fixture',
    );
    await expect(page.locator('body')).not.toContainText('password_hash');
    await pool.query('ALTER TABLE users_failure_fixture RENAME TO users');
    failed = false;
    await page
      .getByRole('button', { name: 'ลองอีกครั้ง', exact: true })
      .click();
    await expect(page.locator('[data-profile]')).toBeVisible();
    await expect(page.locator('[data-status-page]')).toHaveCount(0);
  } finally {
    if (slow) {
      await pool.query('DROP VIEW IF EXISTS users');
      await pool.query('ALTER TABLE users_loading_fixture RENAME TO users');
    }
    if (failed)
      await pool.query('ALTER TABLE users_failure_fixture RENAME TO users');
    await pool.end();
  }
});
