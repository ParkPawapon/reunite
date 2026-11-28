import { createMatchingHandlers } from '@/lib/http/matching-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = createMatchingHandlers().reportStatus;
