import 'server-only';
import { MatchingFailure } from '../application/matching-worker';
import type { MatchJob, MatchingProvider } from '../domain/matching';

export type ProviderEntry = {
  name: string;
  provider: MatchingProvider;
};

export class FallbackMatchingProvider implements MatchingProvider {
  private readonly cooldownUntilMs = new Map<string, number>();

  constructor(
    private readonly entries: readonly ProviderEntry[],
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!entries.length)
      throw new Error(
        'FallbackMatchingProvider requires at least one provider',
      );
  }

  async compare(job: MatchJob) {
    const currentMs = this.now();
    let retryAfterMin: number | undefined;
    let firstRetryable: MatchingFailure | undefined;
    let lastError: unknown;
    let sawRateLimit = false;

    for (const entry of this.entries) {
      const cooldownUntil = this.cooldownUntilMs.get(entry.name) ?? 0;
      if (cooldownUntil > currentMs) {
        sawRateLimit = true;
        const remaining = Math.max(
          60,
          Math.ceil((cooldownUntil - currentMs) / 1000),
        );
        retryAfterMin =
          retryAfterMin === undefined
            ? remaining
            : Math.min(retryAfterMin, remaining);
        continue;
      }

      try {
        const result = await entry.provider.compare(job);
        this.cooldownUntilMs.delete(entry.name);
        return result;
      } catch (error) {
        lastError = error;
        if (error instanceof MatchingFailure) {
          if (error.code === 'INPUT_TOO_LARGE') throw error;
          if (error.code === 'PROVIDER_RATE_LIMITED') {
            sawRateLimit = true;
            const delay = Math.max(60, error.retryAfterSeconds ?? 900);
            this.cooldownUntilMs.set(entry.name, currentMs + delay * 1000);
            retryAfterMin =
              retryAfterMin === undefined
                ? delay
                : Math.min(retryAfterMin, delay);
            continue;
          }
          if (error.retryable && !firstRetryable) firstRetryable = error;
        }
      }
    }

    if (sawRateLimit) {
      throw new MatchingFailure(
        'PROVIDER_RATE_LIMITED',
        true,
        retryAfterMin ?? 900,
      );
    }
    if (firstRetryable) throw firstRetryable;
    if (lastError instanceof MatchingFailure) throw lastError;
    throw new MatchingFailure('PROVIDER_UNAVAILABLE', true);
  }
}
