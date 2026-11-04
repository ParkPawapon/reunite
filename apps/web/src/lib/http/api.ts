import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@campus/shared';
import { databaseErrorCode } from '@campus/database';
import { logRequest } from '@/lib/observability/logger';

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export const idSchema = z.coerce.number().int().positive().max(2147483647);
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new AppError('VALIDATION_ERROR', 422, 'Request fields are invalid');
  return parsed.data;
}
export function queryInput(request: Request) {
  const params = new URL(request.url).searchParams;
  if (new Set(params.keys()).size !== [...params.keys()].length)
    throw new AppError(
      'VALIDATION_ERROR',
      422,
      'Duplicate query parameters are not accepted',
    );
  return Object.fromEntries(params);
}
export async function jsonBody(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  )
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Use application/json');
  const maxBytes = 32768;
  const contentLength = request.headers.get('content-length');
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)
  )
    throw new AppError('PAYLOAD_TOO_LARGE', 413, 'JSON body exceeds 32 KiB');
  if (!request.body)
    throw new AppError('INVALID_JSON', 400, 'A JSON body is required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError(
          'PAYLOAD_TOO_LARGE',
          413,
          'JSON body exceeds 32 KiB',
        );
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new AppError('INVALID_JSON', 400, 'Malformed JSON');
  }
}
export function success(data: unknown, status = 200, meta?: unknown) {
  return Response.json(meta === undefined ? { data } : { data, meta }, {
    status,
  });
}
function safeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  switch (databaseErrorCode(error)) {
    case '23505':
      return new AppError('CONFLICT', 409, 'A conflicting record exists');
    case '23503':
      return new AppError(
        'INVALID_REFERENCE',
        422,
        'A referenced record is unavailable',
      );
    case '23514':
    case '22001':
      return new AppError(
        'VALIDATION_ERROR',
        422,
        'Record constraints were not satisfied',
      );
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ETIMEDOUT':
    case '53300':
    case '57P01':
    case '57014':
      return new AppError(
        'UNAVAILABLE',
        503,
        'Service temporarily unavailable',
      );
    default:
      return new AppError(
        'INTERNAL_ERROR',
        500,
        'An unexpected error occurred',
      );
  }
}
export async function api(
  request: Request,
  action: () => Promise<Response>,
): Promise<Response> {
  const requestId = randomUUID();
  const started = performance.now();
  let response: Response;
  try {
    response = await action();
  } catch (error) {
    const safe = safeError(error);
    response = Response.json(
      { error: { code: safe.code, message: safe.message, requestId } },
      { status: safe.status },
    );
  }
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  logRequest({
    requestId,
    method: request.method,
    status: response.status,
    durationMs: Math.round(performance.now() - started),
  });
  return response;
}
