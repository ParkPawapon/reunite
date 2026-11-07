import 'server-only';
import { z } from 'zod';
import { AppError } from '@campus/shared';
import { services, type createServices } from '@/lib/composition';
import { serverConfig } from '@/config/server';
import { assertSameOrigin } from '@/lib/security/origin';
import { readSessionToken } from '@/lib/security/session';
import { profileSchema } from '@/modules/users/presentation/profile-schema';
import {
  normalizeProfileImage,
  MAX_AVATAR_BYTES,
} from '@/modules/users/infrastructure/profile-image';
import { api, idSchema, jsonBody, parse, queryInput, success } from './api';

// Raw image bodies avoid multipart overhead and let the server enforce a streaming byte limit.
async function imageBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_AVATAR_BYTES))
    throw new AppError('PAYLOAD_TOO_LARGE', 413, 'Image exceeds 2 MiB');
  if (!request.body) throw new AppError('INVALID_IMAGE', 422, 'Image required');
  const reader = request.body.getReader();
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_AVATAR_BYTES) {
        await reader.cancel();
        throw new AppError('PAYLOAD_TOO_LARGE', 413, 'Image exceeds 2 MiB');
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}

export function createAccountHandlers(
  resolve: () => ReturnType<typeof createServices> = services,
) {
  const user = (request: Request) =>
    resolve().auth.requireUser(
      readSessionToken(request, serverConfig().SESSION_COOKIE_NAME),
    );
  const mutation = (request: Request) =>
    assertSameOrigin(request, serverConfig().APP_BASE_URL);
  return {
    profile: (request: Request) =>
      api(request, async () =>
        success(await resolve().profile.get((await user(request)).userId)),
      ),
    updateProfile: (request: Request) =>
      api(request, async () => {
        mutation(request);
        const identity = await user(request);
        return success(
          await resolve().profile.update(
            identity.userId,
            parse(profileSchema, await jsonBody(request)),
          ),
        );
      }),
    avatar: (request: Request) =>
      api(request, async () => {
        const data = await resolve().profile.avatar(
          (await user(request)).userId,
        );
        return new Response(new Uint8Array(data), {
          headers: {
            'Content-Type': 'image/webp',
            'Content-Disposition': 'inline; filename="profile.webp"',
            'Cross-Origin-Resource-Policy': 'same-origin',
          },
        });
      }),
    uploadAvatar: (request: Request) =>
      api(request, async () => {
        mutation(request);
        const identity = await user(request);
        const image = await normalizeProfileImage(
          await imageBody(request),
          request.headers
            .get('content-type')
            ?.split(';')[0]
            ?.trim()
            .toLowerCase() ?? '',
        );
        return success(
          await resolve().profile.setAvatar(
            identity.userId,
            image.data,
            image.version,
          ),
        );
      }),
    deleteAvatar: (request: Request) =>
      api(request, async () => {
        mutation(request);
        return success(
          await resolve().profile.setAvatar(
            (await user(request)).userId,
            null,
            null,
          ),
        );
      }),
    notifications: (request: Request) =>
      api(request, async () => {
        const identity = await user(request);
        const { before } = parse(
          z.object({ before: idSchema.optional() }).strict(),
          queryInput(request),
        );
        return success(
          await resolve().notifications.list(identity.userId, before),
        );
      }),
    readNotifications: (request: Request) =>
      api(request, async () => {
        mutation(request);
        const identity = await user(request);
        const { throughId } = parse(
          z.object({ throughId: idSchema }).strict(),
          await jsonBody(request),
        );
        await resolve().notifications.markRead(identity.userId, throughId);
        return success({ updated: true });
      }),
  };
}
