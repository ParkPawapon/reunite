import 'server-only';
import { logMatchingFailure } from '@/lib/observability/logger';
import { createMatchingWorker } from './create-matching-worker';

const processState = globalThis as typeof globalThis & {
  reuniteMatchingStarted?: boolean;
};
export function startMatching() {
  if (process.env.VERCEL === '1' || processState.reuniteMatchingStarted) return;
  const worker = createMatchingWorker();
  if (!worker) return;
  processState.reuniteMatchingStarted = true;
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
