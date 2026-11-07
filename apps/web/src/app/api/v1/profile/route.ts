import { createAccountHandlers } from '@/lib/http/account-handlers';
export const runtime = 'nodejs';
const handlers = createAccountHandlers();
export const GET = handlers.profile;
export const PATCH = handlers.updateProfile;
