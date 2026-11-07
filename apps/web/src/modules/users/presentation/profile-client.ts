import { z } from 'zod';
const text = z.string().nullable();
export const studentProfileDto = z.object({
  userId: z.number().int().positive(),
  name: z.string(),
  email: z.email(),
  firstName: text,
  lastName: text,
  studentId: text,
  faculty: text,
  department: text,
  major: text,
  phone: text,
  avatarVersion: text,
});
export class AccountRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super('Account request failed');
  }
}
export async function accountRequest<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
) {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: init?.signal ?? AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const result = z
      .object({ error: z.object({ code: z.string() }) })
      .safeParse(await response.json().catch(() => null));
    throw new AccountRequestError(
      result.success ? result.data.error.code : 'UNAVAILABLE',
      response.status,
    );
  }
  const parsed = z.object({ data: schema }).safeParse(await response.json());
  if (!parsed.success) throw new AccountRequestError('UNAVAILABLE', 503);
  return parsed.data.data;
}
