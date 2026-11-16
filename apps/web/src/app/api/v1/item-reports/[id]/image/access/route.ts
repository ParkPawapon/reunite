import { createMatchingHandlers } from '@/lib/http/matching-handlers';
export const runtime = 'nodejs';
export const GET = createMatchingHandlers().imageAccess;
