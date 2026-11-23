import { createAccountHandlers } from '@/lib/http/account-handlers';

export const runtime = 'nodejs';
export const POST = createAccountHandlers().completeProfile;
