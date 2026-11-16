import 'server-only';
import { z } from 'zod';

export const matchingEnvSchema = z.object({
  MATCHING_ENABLED: z.enum(['true', 'false']).default('false'),
  OPENAI_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  // Lifetime, conservative reservations across every pair/retry, in USD (not per day).
  MATCHING_BUDGET_USD: z.coerce.number().finite().min(0).max(1000).default(0),
});
export const MATCHING_MODEL = 'gpt-5.4-mini-2026-03-17';
export const MATCHING_RESERVATION_USD_MICROS = 100_000;
export function matchingConfig() {
  const parsed = matchingEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error('Invalid matching environment');
  const { MATCHING_ENABLED, OPENAI_API_KEY, MATCHING_BUDGET_USD } = parsed.data;
  if (
    MATCHING_ENABLED === 'true' &&
    (!OPENAI_API_KEY || MATCHING_BUDGET_USD < 0.1)
  )
    throw new Error(
      'Matching requires OPENAI_API_KEY and MATCHING_BUDGET_USD >= 0.10',
    );
  return {
    enabled: MATCHING_ENABLED === 'true',
    apiKey: OPENAI_API_KEY,
    budgetUsdMicros: Math.floor(MATCHING_BUDGET_USD * 1_000_000),
  };
}
