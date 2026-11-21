import { createMatchingHandlers } from '@/lib/http/matching-handlers';

export const runtime = 'nodejs';
const handlers = createMatchingHandlers();
export const GET = handlers.getReturn;
export const PUT = handlers.confirmReturn;
