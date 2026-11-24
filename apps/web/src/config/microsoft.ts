import 'server-only';
import { z } from 'zod';

export const entraId = z
  .guid()
  .refine((value) => value !== '00000000-0000-0000-0000-000000000000');

const microsoftEnv = z.object({
  MICROSOFT_CLIENT_ID: entraId,
  MICROSOFT_CLIENT_SECRET: z.string().trim().min(1),
  MICROSOFT_TENANT_ID: entraId,
});

export function microsoftConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!Object.keys(microsoftEnv.shape).some((key) => env[key]?.trim()))
    return null;
  const parsed = microsoftEnv.safeParse(env);
  if (!parsed.success) throw new Error('Invalid Microsoft sign-in environment');
  return {
    clientId: parsed.data.MICROSOFT_CLIENT_ID.toLowerCase(),
    clientSecret: parsed.data.MICROSOFT_CLIENT_SECRET,
    tenantId: parsed.data.MICROSOFT_TENANT_ID.toLowerCase(),
  };
}
