import 'server-only';
import { z } from 'zod';
import {
  createMatchReturnService,
  services,
  type createServices,
} from '@/lib/composition';
import { serverConfig } from '@/config/server';
import {
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

export function createMatchingHandlers(
  resolve: () => ReturnType<typeof createServices> = services,
  resolveMatchReturn = createMatchReturnService,
) {
  const user = (request: Request) =>
    resolve().auth.requireUser(
      readSessionToken(request, serverConfig().SESSION_COOKIE_NAME),
    );
  return {
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
        const quotaExhausted =
          config.provider === 'cloudflare'
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
    image: (request: Request, context: RouteContext) =>
      api(request, async () => {
        const id = parse(idSchema, (await context.params).id);
        const image = await resolve().reportImages.get(id);
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
        await resolve().reportImages.requireOwner(id, identity.userId);
        const image = await normalizeReportImage(
          await binaryBody(request, MAX_REPORT_IMAGE_BYTES),
          request.headers
            .get('content-type')
            ?.split(';')[0]
            ?.trim()
            .toLowerCase() ?? '',
        );
        return success(
          await resolve().reportImages.set(id, identity.userId, image),
        );
      }),
    deleteImage: (request: Request, context: RouteContext) =>
      api(request, async () => {
        assertSameOrigin(request, serverConfig().APP_BASE_URL);
        const identity = await user(request);
        const id = parse(idSchema, (await context.params).id);
        return success(
          await resolve().reportImages.set(id, identity.userId, null),
        );
      }),
  };
}
