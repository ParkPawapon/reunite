import 'server-only';
import { getPool } from '@campus/database';
import {
  matchingConfig,
  MATCHING_RESERVATION_USD_MICROS,
} from '@/config/matching';
import { MatchingWorker } from '../application/matching-worker';
import { CloudflareMatchingProvider } from './cloudflare-matching-provider';
import { OpenAiMatchingProvider } from './openai-matching-provider';
import { PgMatchingQueue } from './pg-matching-queue';

export function createMatchingWorker() {
  const config = matchingConfig();
  if (!config.enabled || !config.apiKey) return null;
  if (config.provider === 'cloudflare') {
    if (!config.accountId) throw new Error('Cloudflare account ID missing');
    return new MatchingWorker(
      new PgMatchingQueue(getPool(), config.freeDailyLimit),
      new CloudflareMatchingProvider(config.accountId, config.apiKey),
      0,
      0,
    );
  }
  return new MatchingWorker(
    new PgMatchingQueue(getPool()),
    new OpenAiMatchingProvider(config.apiKey),
    config.budgetUsdMicros,
    MATCHING_RESERVATION_USD_MICROS,
  );
}
