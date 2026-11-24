import 'server-only';
import { getPool } from '@campus/database';
import {
  isFreeMatchingProvider,
  matchingConfig,
  MATCHING_RESERVATION_USD_MICROS,
  type FreeProviderSettings,
} from '@/config/matching';
import { MatchingWorker } from '../application/matching-worker';
import type { MatchingProvider } from '../domain/matching';
import { CloudflareMatchingProvider } from './cloudflare-matching-provider';
import {
  FallbackMatchingProvider,
  type ProviderEntry,
} from './fallback-matching-provider';
import { GeminiMatchingProvider } from './gemini-matching-provider';
import { GroqMatchingProvider } from './groq-matching-provider';
import { OpenAiMatchingProvider } from './openai-matching-provider';
import { PgMatchingQueue } from './pg-matching-queue';

function buildFreeProvider(entry: FreeProviderSettings): MatchingProvider {
  switch (entry.provider) {
    case 'gemini':
      return new GeminiMatchingProvider(entry.apiKey, entry.model);
    case 'groq':
      return new GroqMatchingProvider(entry.apiKey, entry.model);
    case 'cloudflare':
      return new CloudflareMatchingProvider(entry.accountId, entry.apiKey);
  }
}

export function createMatchingWorker() {
  const config = matchingConfig();
  if (!config.enabled) return null;

  if (isFreeMatchingProvider(config.provider)) {
    const entries: ProviderEntry[] = config.freeProviders.map((entry) => ({
      name: entry.provider,
      provider: buildFreeProvider(entry),
    }));
    const first = entries[0];
    if (!first) return null;
    const provider =
      entries.length === 1
        ? first.provider
        : new FallbackMatchingProvider(entries);
    return new MatchingWorker(
      new PgMatchingQueue(getPool(), config.freeDailyLimit),
      provider,
      0,
      0,
    );
  }

  if (!config.apiKey) return null;
  return new MatchingWorker(
    new PgMatchingQueue(getPool()),
    new OpenAiMatchingProvider(config.apiKey),
    config.budgetUsdMicros,
    MATCHING_RESERVATION_USD_MICROS,
  );
}
