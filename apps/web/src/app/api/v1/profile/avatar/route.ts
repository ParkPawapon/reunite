import { createAccountHandlers } from '@/lib/http/account-handlers';
export const runtime = 'nodejs';
const handlers = createAccountHandlers();
export const GET = handlers.avatar;
export const PUT = handlers.uploadAvatar;
export const DELETE = handlers.deleteAvatar;
