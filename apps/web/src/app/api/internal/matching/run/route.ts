import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@campus/shared';
import { api, success } from '@/lib/http/api';
import { createMatchingWorker } from '@/modules/matching/infrastructure/create-matching-worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_JOBS_PER_RUN = 4;
const BATCH_BUDGET_MS = 42_000;

export async function POST(request: Request) {
  return api(request, async () => {
    const secret = process.env.MATCHING_RUNNER_SECRET;
    const auth = request.headers.get('authorization');
    if (
      !secret ||
      !/^[a-f0-9]{64}$/.test(secret) ||
      !auth ||
      !/^Bearer [a-f0-9]{64}$/.test(auth) ||
      !timingSafeEqual(Buffer.from(auth.slice(7)), Buffer.from(secret))
    )
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    const worker = createMatchingWorker();
    if (!worker) return success({ processed: false });

    const startedAt = Date.now();
    let processedCount = 0;
    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      if (i > 0 && Date.now() - startedAt >= BATCH_BUDGET_MS) break;
      const didProcess = await worker.runOnce();
      if (!didProcess) break;
      processedCount++;
    }
    return success({ processed: processedCount > 0 });
  });
}
