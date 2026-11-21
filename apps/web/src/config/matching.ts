import 'server-only';
import { z } from 'zod';

export const matchingEnvSchema = z.object({
  MATCHING_ENABLED: z.enum(['true', 'false']).default('false'),
  MATCHING_PROVIDER: z.enum(['openai', 'cloudflare']).default('openai'),
  CLOUDFLARE_ACCOUNT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^[a-f0-9]{32}$/i)
      .optional(),
  ),
  CLOUDFLARE_WORKERS_AI_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  MATCHING_FREE_DAILY_LIMIT: z.coerce.number().int().min(1).max(10).default(10),
  OPENAI_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  // Lifetime, conservative reservations across every pair/retry, in USD (not per day).
  MATCHING_BUDGET_USD: z.coerce.number().finite().min(0).max(1000).default(0),
});
export const MATCHING_MODEL = 'gpt-5.4-mini-2026-03-17';
export const CLOUDFLARE_MATCHING_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const MATCHING_RESERVATION_USD_MICROS = 100_000;
export function matchingConfig() {
  const parsed = matchingEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error('Invalid matching environment');
  const {
    MATCHING_ENABLED,
    MATCHING_PROVIDER,
    OPENAI_API_KEY,
    MATCHING_BUDGET_USD,
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_WORKERS_AI_TOKEN,
    MATCHING_FREE_DAILY_LIMIT,
  } = parsed.data;
  const enabled = MATCHING_ENABLED === 'true';
  if (MATCHING_PROVIDER === 'cloudflare') {
    if (MATCHING_BUDGET_USD !== 0)
      throw new Error('Cloudflare Free matching requires a zero USD budget');
    if (enabled && !(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_WORKERS_AI_TOKEN))
      throw new Error(
        'Cloudflare matching requires an account ID and a Workers AI token',
      );
    return {
      enabled,
      provider: MATCHING_PROVIDER,
      accountId: CLOUDFLARE_ACCOUNT_ID,
      apiKey: CLOUDFLARE_WORKERS_AI_TOKEN,
      freeDailyLimit: MATCHING_FREE_DAILY_LIMIT,
      budgetUsdMicros: 0,
    };
  }
  if (enabled && (!OPENAI_API_KEY || MATCHING_BUDGET_USD < 0.1))
    throw new Error(
      'Matching requires OPENAI_API_KEY and MATCHING_BUDGET_USD >= 0.10',
    );
  return {
    enabled,
    provider: MATCHING_PROVIDER,
    apiKey: OPENAI_API_KEY,
    budgetUsdMicros: Math.floor(MATCHING_BUDGET_USD * 1_000_000),
  };
}
