import 'server-only';
import { z } from 'zod';

export const entraId = z
  .guid()
  .refine((value) => value !== '00000000-0000-0000-0000-000000000000');

const microsoftEnv = z.object({
  MICROSOFT_CLIENT_ID: entraId,
  MICROSOFT_CLIENT_SECRET: z.string().trim().min(1),
  MICROSOFT_TENANT_ID: entraId,
  MICROSOFT_STUDENT_ID_CLAIM: z
    .string()
    .trim()
    .regex(/^(?:extn\.[a-zA-Z0-9_]{1,128})?$/)
    .optional(),
});

export function microsoftConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!Object.keys(microsoftEnv.shape).some((key) => env[key]?.trim()))
    return null;
  const parsed = microsoftEnv.safeParse(env);
  if (!parsed.success) throw new Error('Invalid Microsoft sign-in environment');
  const studentIdClaim = parsed.data.MICROSOFT_STUDENT_ID_CLAIM;
  return {
    clientId: parsed.data.MICROSOFT_CLIENT_ID.toLowerCase(),
    clientSecret: parsed.data.MICROSOFT_CLIENT_SECRET,
    tenantId: parsed.data.MICROSOFT_TENANT_ID.toLowerCase(),
    ...(studentIdClaim ? { studentIdClaim } : {}),
  };
}
