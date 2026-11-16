import 'server-only';
import { AppError } from '@campus/shared';
export async function binaryBody(request: Request, maxBytes: number) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new AppError('PAYLOAD_TOO_LARGE', 413, 'Image exceeds upload limit');
  if (!request.body) throw new AppError('INVALID_IMAGE', 422, 'Image required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError(
          'PAYLOAD_TOO_LARGE',
          413,
          'Image exceeds upload limit',
        );
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
