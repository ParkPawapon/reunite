import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
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
        INSERT INTO users (name, email, microsoft_tenant_id, microsoft_object_id, first_name, last_name, faculty, department, major)
        VALUES ('new-member', $1, $2, $3, 'ทดสอบ', 'บัญชีมหาวิทยาลัย', 'คณะเดิม', 'ภาควิชาเดิม', 'สาขาวิชาเดิม') RETURNING user_id
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

    await expect(page.getByLabel('ชื่อจริง')).toHaveCount(0);
    await expect(page.getByLabel('นามสกุล')).toHaveCount(0);
    const save = page.getByRole('button', { name: 'บันทึกและไปหน้าภาพรวม' });
    const alert = page.locator('form').getByRole('alert');
    await save.click();
    await expect(alert).toContainText('กรุณากรอกรหัสนักศึกษา');
    await page.getByLabel('รหัสนักศึกษา').fill('0987654321');

    const faculty = page.getByRole('combobox', { name: 'คณะ' });
    const department = page.getByRole('combobox', { name: 'ภาควิชา' });
    const major = page.getByRole('combobox', { name: 'สาขาวิชา' });
    const option = (name: string) =>
      page.getByRole('option', { name, exact: true });
    async function choose(field: Locator, name: string) {
      await field.click();
      await option(name).click();
    }
    await expect(faculty).toHaveText('คณะเดิม');
    await expect(department).toHaveText('ภาควิชาเดิม');
    await expect(major).toHaveText('สาขาวิชาเดิม');

    await choose(faculty, 'เลือกคณะ');
    await expect(department).toHaveCount(0);
    await expect(major).toHaveCount(0);
    await save.click();
    await expect(alert).toHaveText('กรุณาเลือกคณะ');
    await choose(faculty, 'คณะวิศวกรรมศาสตร์');
    await expect(department).toHaveText('เลือกภาควิชา');
    await expect(major).toHaveCount(0);
    const departmentField = page
      .locator('form > div')
      .filter({ has: department });
    const frames = await departmentField.evaluate(async (field) => {
      const [animation] = field.getAnimations();
      if (!animation) return null;
      animation.pause();
      await animation.ready;
      animation.currentTime = 0;
      const start = getComputedStyle(field);
      const from = {
        opacity: start.opacity,
        y: new DOMMatrix(start.transform).m42,
      };
      animation.finish();
      return { from, toOpacity: getComputedStyle(field).opacity };
    });
    expect(frames?.from.opacity).toBe('0');
    expect(frames?.from.y).toBeLessThan(0);
    expect(frames?.toOpacity).toBe('1');
    await save.click();
    await expect(alert).toHaveText('กรุณาเลือกภาควิชา');
    await choose(department, 'ภาควิชาวิศวกรรมคอมพิวเตอร์');
    await major.click();
    await expect(option('วิศวกรรมโยธา')).toHaveCount(0);
    await option('วิศวกรรมคอมพิวเตอร์').click();
    await choose(department, 'ภาควิชาวิศวกรรมโยธา');
    await expect(major).toHaveText('เลือกสาขาวิชา');
    await choose(major, 'วิศวกรรมโยธา');

    await choose(department, 'ไม่ระบุภาควิชา');
    await choose(major, 'วิศวกรรมไฟฟ้าและสารสนเทศ');

    await choose(faculty, 'คณะเทคโนโลยีสารสนเทศ');
    await expect(department).toHaveCount(0);
    await expect(major).toHaveText('เลือกสาขาวิชา');
    await choose(major, 'วิทยาการคอมพิวเตอร์ (หลักสูตรภาษาอังกฤษ)');

    await choose(faculty, 'คณะวิศวกรรมศาสตร์');
    await choose(department, 'ภาควิชาวิศวกรรมคอมพิวเตอร์');
    await save.click();
    await expect(alert).toHaveText('กรุณาเลือกสาขาวิชา');
    await choose(major, 'วิศวกรรมคอมพิวเตอร์');
    await save.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect((await page.request.get('/api/v1/item-reports')).status()).toBe(200);
    expect(
      await (await page.request.get('/api/v1/profile')).json(),
    ).toMatchObject({
      data: {
        firstName: 'ทดสอบ',
        lastName: 'บัญชีมหาวิทยาลัย',
        studentId: '0987654321',
        faculty: 'คณะวิศวกรรมศาสตร์',
        department: 'ภาควิชาวิศวกรรมคอมพิวเตอร์',
        major: 'วิศวกรรมคอมพิวเตอร์',
      },
    });
    await page.goto('/complete-profile');
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    await pool.end();
  }
});
