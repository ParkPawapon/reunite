import { createMatchingHandlers } from '@/lib/http/matching-handlers';
export const runtime = 'nodejs';
const handlers = createMatchingHandlers();
export const GET = handlers.image;
export const PUT = handlers.uploadImage;
export const DELETE = handlers.deleteImage;
