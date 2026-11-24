import {
  itemImages,
  reviewAssessment,
  type MatchingProvider,
  type MatchingQueue,
} from '../domain/matching';

export type MatchingFailureTelemetry = {
  stage?: string;
  httpStatus?: number;
  detail?: string;
};

export class MatchingFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly retryAfterSeconds?: number,
    public readonly telemetry?: MatchingFailureTelemetry,
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
        Number(itemImages(job.lost).length > 0) +
        Number(itemImages(job.found).length > 0);
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
      await this.queue.fail(
        job,
        failure.code,
        failure.retryable,
        failure.retryAfterSeconds,
      );
    }
    return true;
  }
}
