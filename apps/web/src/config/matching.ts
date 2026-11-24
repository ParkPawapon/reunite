import 'server-only';
import { z } from 'zod';

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

export const FREE_MATCHING_PROVIDERS = [
  'gemini',
  'groq',
  'cloudflare',
] as const;
export type FreeMatchingProviderName = (typeof FREE_MATCHING_PROVIDERS)[number];
export type MatchingProviderName = 'openai' | 'auto' | FreeMatchingProviderName;

export const MATCHING_MODEL = 'gpt-5.4-mini-2026-03-17';
export const CLOUDFLARE_MATCHING_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const GEMINI_MATCHING_MODEL = 'gemini-3.8-flash';
export const GROQ_MATCHING_MODEL = 'qwen/qwen3.8-27b';
export const MATCHING_RESERVATION_USD_MICROS = 100_000;

export const matchingEnvSchema = z.object({
  MATCHING_ENABLED: z.enum(['true', 'false']).default('false'),
  MATCHING_PROVIDER: z
    .enum(['openai', 'cloudflare', 'gemini', 'groq', 'auto'])
    .default('openai'),
  MATCHING_FREE_FALLBACK: z.enum(['true', 'false']).default('true'),
  MATCHING_FREE_ORDER: emptyToUndefined(z.string().trim().min(1).optional()),
  GEMINI_API_KEY: emptyToUndefined(z.string().trim().min(1).optional()),
  GEMINI_MODEL: emptyToUndefined(
    z
      .string()
      .trim()
      .regex(/^gemini-[a-z0-9._-]{1,80}$/i)
      .optional(),
  ),
  GROQ_API_KEY: emptyToUndefined(z.string().trim().min(1).optional()),
  GROQ_MODEL: emptyToUndefined(
    z
      .string()
      .trim()
      .regex(/^[a-z0-9._/-]{2,120}$/i)
      .optional(),
  ),
  CLOUDFLARE_ACCOUNT_ID: emptyToUndefined(
    z
      .string()
      .trim()
      .regex(/^[a-f0-9]{32}$/i)
      .optional(),
  ),
  CLOUDFLARE_WORKERS_AI_TOKEN: emptyToUndefined(
    z.string().trim().min(1).optional(),
  ),
  MATCHING_FREE_DAILY_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(10),
  OPENAI_API_KEY: emptyToUndefined(z.string().trim().min(1).optional()),
  // Lifetime, conservative reservations across every pair/retry, in USD (not per day).
  MATCHING_BUDGET_USD: z.coerce.number().finite().min(0).max(1000).default(0),
});

export type FreeProviderSettings =
  | { provider: 'gemini'; apiKey: string; model: string }
  | { provider: 'groq'; apiKey: string; model: string }
  | {
      provider: 'cloudflare';
      accountId: string;
      apiKey: string;
      model: string;
    };

export function isFreeMatchingProvider(provider: MatchingProviderName) {
  return provider !== 'openai';
}

function parseFreeOrder(raw?: string): FreeMatchingProviderName[] {
  if (!raw) return [...FREE_MATCHING_PROVIDERS];
  const entries = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const parsed: FreeMatchingProviderName[] = [];
  for (const entry of entries) {
    if (!(FREE_MATCHING_PROVIDERS as readonly string[]).includes(entry))
      throw new Error('Invalid matching environment');
    const typed = entry as FreeMatchingProviderName;
    if (!parsed.includes(typed)) parsed.push(typed);
  }
  return parsed.length ? parsed : [...FREE_MATCHING_PROVIDERS];
}

export function matchingConfig() {
  const parsed = matchingEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error('Invalid matching environment');
  const {
    MATCHING_ENABLED,
    MATCHING_PROVIDER,
    MATCHING_FREE_FALLBACK,
    MATCHING_FREE_ORDER,
    OPENAI_API_KEY,
    MATCHING_BUDGET_USD,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_WORKERS_AI_TOKEN,
    MATCHING_FREE_DAILY_LIMIT,
  } = parsed.data;
  const enabled = MATCHING_ENABLED === 'true';

  if (isFreeMatchingProvider(MATCHING_PROVIDER)) {
    if (MATCHING_BUDGET_USD !== 0)
      throw new Error('Free matching requires a zero USD budget');

    const order = parseFreeOrder(MATCHING_FREE_ORDER);
    const configured = new Map<
      FreeMatchingProviderName,
      FreeProviderSettings
    >();
    if (GEMINI_API_KEY) {
      configured.set('gemini', {
        provider: 'gemini',
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL ?? GEMINI_MATCHING_MODEL,
      });
    }
    if (GROQ_API_KEY) {
      configured.set('groq', {
        provider: 'groq',
        apiKey: GROQ_API_KEY,
        model: GROQ_MODEL ?? GROQ_MATCHING_MODEL,
      });
    }
    if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_WORKERS_AI_TOKEN) {
      configured.set('cloudflare', {
        provider: 'cloudflare',
        accountId: CLOUDFLARE_ACCOUNT_ID,
        apiKey: CLOUDFLARE_WORKERS_AI_TOKEN,
        model: CLOUDFLARE_MATCHING_MODEL,
      });
    }

    if (
      enabled &&
      MATCHING_PROVIDER === 'cloudflare' &&
      !configured.has('cloudflare')
    ) {
      throw new Error(
        'Cloudflare matching requires an account ID and a Workers AI token',
      );
    }
    if (
      enabled &&
      MATCHING_PROVIDER === 'gemini' &&
      !configured.has('gemini')
    ) {
      throw new Error('Gemini matching requires GEMINI_API_KEY');
    }
    if (enabled && MATCHING_PROVIDER === 'groq' && !configured.has('groq')) {
      throw new Error('Groq matching requires GROQ_API_KEY');
    }

    const freeProviders: FreeProviderSettings[] = [];
    if (MATCHING_PROVIDER === 'auto') {
      for (const name of order) {
        const entry = configured.get(name);
        if (entry) freeProviders.push(entry);
      }
      if (enabled && !freeProviders.length) {
        throw new Error(
          'Auto free matching requires GEMINI_API_KEY, GROQ_API_KEY, or Cloudflare Workers AI credentials',
        );
      }
    } else {
      const primary = configured.get(MATCHING_PROVIDER);
      if (primary) freeProviders.push(primary);
      if (MATCHING_FREE_FALLBACK === 'true') {
        for (const name of order) {
          if (name === MATCHING_PROVIDER) continue;
          const backup = configured.get(name);
          if (backup) freeProviders.push(backup);
        }
      }
    }

    const lead = freeProviders[0];
    return {
      enabled,
      provider: MATCHING_PROVIDER,
      freeProviders,
      accountId:
        lead?.provider === 'cloudflare'
          ? lead.accountId
          : CLOUDFLARE_ACCOUNT_ID,
      apiKey: lead?.apiKey,
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
    freeProviders: [] as FreeProviderSettings[],
    apiKey: OPENAI_API_KEY,
    freeDailyLimit: MATCHING_FREE_DAILY_LIMIT,
    budgetUsdMicros: Math.floor(MATCHING_BUDGET_USD * 1_000_000),
  };
}
