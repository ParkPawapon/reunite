import type { MatchingProvider, MatchingQueue } from '../domain/matching';
import { reviewAssessment } from '../domain/matching';

export class MatchingFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}
export class MatchingWorker {
  constructor(
    private readonly queue: MatchingQueue,
    private readonly provider: MatchingProvider,
    private readonly budgetUsdMicros: number,
    private readonly reservationUsdMicros: number,
  ) {}
  async runOnce() {
    await this.queue.reconcile();
    const job = await this.queue.claim(
      this.budgetUsdMicros,
      this.reservationUsdMicros,
    );
    if (!job) return false;
    try {
      const result = await this.provider.compare(job);
      const images =
        Number(Boolean(job.lost.image)) + Number(Boolean(job.found.image));
      const expected = images === 2 ? 'both' : images === 1 ? 'one' : 'none';
      if (result.assessment.imageComparison !== expected)
        throw new MatchingFailure('INVALID_IMAGE_ASSESSMENT', false);
      await this.queue.complete(job, {
        ...result,
        assessment: reviewAssessment(result.assessment),
      });
    } catch (error) {
      const failure =
        error instanceof MatchingFailure
          ? error
          : new MatchingFailure('PROVIDER_UNAVAILABLE', true);
      await this.queue.fail(job, failure.code, failure.retryable);
    }
    return true;
  }
}
