import 'server-only';
import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_BASE_URL: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, 'Expected an HTTP(S) origin'),
  LOG_LEVEL: z.enum(['info', 'error', 'silent']).default('info'),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^(?:__Host-)?[a-zA-Z][a-zA-Z0-9_]{0,60}$/)
    .default('lost_found_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
});
export function serverConfig() {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid server environment: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  if (
    result.data.SESSION_COOKIE_NAME.startsWith('__Host-') &&
    (result.data.NODE_ENV !== 'production' ||
      new URL(result.data.APP_BASE_URL).protocol !== 'https:')
  )
    throw new Error('__Host- cookies require production HTTPS');
  return result.data;
}
