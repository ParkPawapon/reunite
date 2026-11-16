import 'server-only';
import { getPool } from '@campus/database';
import {
  matchingConfig,
  MATCHING_RESERVATION_USD_MICROS,
} from '@/config/matching';
import { MatchingWorker } from '../application/matching-worker';
import { PgMatchingQueue } from './pg-matching-queue';
import { OpenAiMatchingProvider } from './openai-matching-provider';
import { logMatchingFailure } from '@/lib/observability/logger';

const processState = globalThis as typeof globalThis & {
  reuniteMatchingStarted?: boolean;
};
export function startMatching() {
  const config = matchingConfig();
  if (!config.enabled || !config.apiKey || processState.reuniteMatchingStarted)
    return;
  processState.reuniteMatchingStarted = true;
  const worker = new MatchingWorker(
    new PgMatchingQueue(getPool()),
    new OpenAiMatchingProvider(config.apiKey),
    config.budgetUsdMicros,
    MATCHING_RESERVATION_USD_MICROS,
  );
  const tick = async () => {
    let worked = false;
    try {
      worked = await worker.runOnce();
    } catch {
      logMatchingFailure();
    }
    const timer = setTimeout(() => void tick(), worked ? 2000 : 10000);
    timer.unref();
  };
  void tick();
}
