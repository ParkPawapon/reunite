import { z } from 'zod';
import type { loginSchema } from './schemas';

const loginResponse = z.object({
  data: z.object({
    userId: z.number().int().positive(),
    name: z.string(),
    email: z.email(),
  }),
});

export async function submitLogin(
  credentials: z.infer<typeof loginSchema>,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(credentials),
    signal,
  });
  if (response.status === 401)
    return {
      ok: false,
      message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง',
    };
  if (response.status === 429)
    return {
      ok: false,
      message: 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่',
    };
  if (!response.ok)
    return {
      ok: false,
      message: 'ยังเข้าสู่ระบบไม่ได้ กรุณาลองอีกครั้งในภายหลัง',
    };
  if (!loginResponse.safeParse(await response.json()).success)
    return {
      ok: false,
      message: 'ไม่สามารถยืนยันการเข้าสู่ระบบได้ กรุณาลองอีกครั้ง',
    };
  return { ok: true };
}
