import 'server-only';
import { z } from 'zod';
import {
  createMatchReturnService,
  services,
  type createServices,
} from '@/lib/composition';
import { serverConfig } from '@/config/server';
import {
  isFreeMatchingProvider,
  matchingConfig,
  MATCHING_RESERVATION_USD_MICROS,
} from '@/config/matching';
import { readSessionToken } from '@/lib/security/session';
import { assertSameOrigin } from '@/lib/security/origin';
import { MAX_REPORT_IMAGE_BYTES } from '@/modules/item-reports/domain/report-image-policy';
import { normalizeReportImage } from '@/modules/item-reports/infrastructure/report-image';
import { api, idSchema, jsonBody, parse, queryInput, success } from './api';
import { binaryBody } from './binary-body';
import type { RouteContext } from './handlers';

const revision = z.string().regex(/^[1-9][0-9]{0,18}$/);
const confirmReturn = z.strictObject({
  lostRevision: revision,
  foundRevision: revision,
});
const readSlot = z.strictObject({
  slot: z.enum(['1', '2', '3']).optional(),
});
const writeSlot = z.strictObject({
  slot: z.enum(['1', '2', '3', 'next']).optional(),
});
const deleteSlot = z.strictObject({
  slot: z.enum(['1', '2', '3', 'all']).optional(),
});
const parseSlotNumber = (slot?: '1' | '2' | '3'): 1 | 2 | 3 =>
  slot === '2' ? 2 : slot === '3' ? 3 : 1;

export function createMatchingHandlers(
  resolve: () => ReturnType<typeof createServices> = services,
  resolveMatchReturn = createMatchReturnService,
) {
  const user = (request: Request) =>
    resolve().auth.requireUser(
      readSessionToken(request, serverConfig().SESSION_COOKIE_NAME),
    );
  return {
    reportStatus: (request: Request, context: RouteContext) =>
      api(request, async () => {
        const identity = await user(request);
        const id = parse(idSchema, (await context.params).id);
        const status = await resolve().matching.reportStatus(
          identity.userId,
          id,
        );
        return success({ ...status, enabled: matchingConfig().enabled });
      }),
    getReturn: (request: Request, context: RouteContext) =>
      api(request, async () => {
        const identity = await user(request);
        const id = parse(idSchema, (await context.params).id);
        return success(await resolveMatchReturn().get(id, identity.userId));
      }),
    confirmReturn: (request: Request, context: RouteContext) =>
      api(request, async () => {
        assertSameOrigin(request, serverConfig().APP_BASE_URL);
        const identity = await user(request);
        const id = parse(idSchema, (await context.params).id);
        const input = parse(confirmReturn, await jsonBody(request));
        return success(
          await resolveMatchReturn().confirm(id, identity.userId, input),
        );
      }),
    imageAccess: (request: Request, context: RouteContext) =>
      api(request, async () => {
        const identity = await user(request);
        const id = parse(idSchema, (await context.params).id);
        return success(
          await resolve().reportImages.ownedInfo(id, identity.userId),
        );
      }),
    list: (request: Request) =>
      api(request, async () => {
        const identity = await user(request);
        const { before } = parse(
          z.strictObject({ before: idSchema.optional() }),
          queryInput(request),
        );
        const { reservedUsdMicros, freeAttemptsToday, ...page } =
          await resolve().matching.list(identity.userId, before);
        const config = matchingConfig();
        const quotaExhausted = isFreeMatchingProvider(config.provider)
          ? freeAttemptsToday >= config.freeDailyLimit
          : reservedUsdMicros + MATCHING_RESERVATION_USD_MICROS >
            config.budgetUsdMicros;
        return success({
          ...page,
          serviceStatus: !config.enabled
            ? 'disabled'
            : quotaExhausted
              ? 'budget_exhausted'
              : 'active',
          refreshAfterSeconds: 10,
        });
      }),
    listImages: (request: Request, context: RouteContext) =>
      api(request, async () => {
        await user(request);
        const id = parse(idSchema, (await context.params).id);
        return success(await resolve().reportImages.listImages(id));
      }),
    image: (request: Request, context: RouteContext) =>
      api(request, async () => {
        await user(request);
        const id = parse(idSchema, (await context.params).id);
        const { slot } = parse(readSlot, queryInput(request));
        const image = await resolve().reportImages.get(
          id,
          parseSlotNumber(slot),
        );
        return new Response(new Uint8Array(image), {
          headers: {
            'Content-Type': 'image/webp',
            'Content-Disposition': 'inline; filename="item.webp"',
            'Cross-Origin-Resource-Policy': 'same-origin',
          },
        });
      }),
    uploadImage: (request: Request, context: RouteContext) =>
      api(request, async () => {
        assertSameOrigin(request, serverConfig().APP_BASE_URL);
        const identity = await user(request);
        const id = parse(idSchema, (await context.params).id);
        const { slot } = parse(writeSlot, queryInput(request));
        await resolve().reportImages.requireOwner(id, identity.userId);
        const image = await normalizeReportImage(
          await binaryBody(request, MAX_REPORT_IMAGE_BYTES),
          request.headers
            .get('content-type')
            ?.split(';')[0]
            ?.trim()
            .toLowerCase() ?? '',
        );
        const writeTarget = slot === 'next' ? 'next' : parseSlotNumber(slot);
        return success(
          await resolve().reportImages.set(
            id,
            identity.userId,
            image,
            writeTarget,
          ),
        );
      }),
    deleteImage: (request: Request, context: RouteContext) =>
      api(request, async () => {
        assertSameOrigin(request, serverConfig().APP_BASE_URL);
        const identity = await user(request);
        const id = parse(idSchema, (await context.params).id);
        const { slot } = parse(deleteSlot, queryInput(request));
        const deleteTarget = slot === 'all' ? 'all' : parseSlotNumber(slot);
        return success(
          await resolve().reportImages.set(
            id,
            identity.userId,
            null,
            deleteTarget,
          ),
        );
      }),
  };
}
