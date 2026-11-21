import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@campus/shared';
import { api, success } from '@/lib/http/api';
import { createMatchingWorker } from '@/modules/matching/infrastructure/create-matching-worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    return success({ processed: worker ? await worker.runOnce() : false });
  });
}
