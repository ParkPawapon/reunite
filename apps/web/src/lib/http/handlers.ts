import 'server-only';
import { z } from 'zod';
import { getPool } from '@campus/database';
import { AppError } from '@campus/shared';
import { services, type createServices } from '@/lib/composition';
import { serverConfig } from '@/config/server';
import { assertSameOrigin } from '@/lib/security/origin';
import { readSessionToken, sessionCookie } from '@/lib/security/session';
import { api, jsonBody, parse, queryInput, success, idSchema } from './api';
import { loginSchema } from '@/modules/auth/presentation/schemas';
import {
  reportCreateSchema,
  reportPatchSchema,
} from '@/modules/item-reports/presentation/schemas';
import { reportDto } from '@/modules/item-reports/presentation/dto';
import { listReports } from '@/modules/item-reports/presentation/list-reports';
import { getReport } from '@/modules/item-reports/presentation/get-report';
import { updateReportStatus } from '@/modules/item-reports/presentation/update-report-status';
import { listOwnedReports } from '@/modules/item-reports/presentation/list-owned-reports';
import {
  claimCreateSchema,
  claimHandoverSchema,
} from '@/modules/claims/presentation/schemas';
import { listClaims } from '@/modules/claims/presentation/list-claims';
import { getClaim } from '@/modules/claims/presentation/get-claim';
import { updateClaimStatus } from '@/modules/claims/presentation/update-claim-status';
import { listReportClaims } from '@/modules/claims/presentation/list-report-claims';
import { listCategories } from '@/modules/categories/presentation/list-categories';
import { listLocations } from '@/modules/locations/presentation/list-locations';

export type RouteContext = { params: Promise<{ id: string }> };
type Services = ReturnType<typeof createServices>;
type Dependencies = { services: () => Services; ping: () => Promise<void> };
const contactPreferences = z.strictObject({
  shareEmail: z.boolean(),
  sharePhone: z.boolean(),
});
const contactQuery = z.strictObject({ matchId: idSchema.optional() });
const defaults: Dependencies = {
  services,
  ping: async () => {
    await getPool().query('SELECT 1');
  },
};

export function createHandlers(deps: Dependencies = defaults) {
  const currentToken = (request: Request) =>
    readSessionToken(request, serverConfig().SESSION_COOKIE_NAME);
  const requireUser = (request: Request) =>
    deps.services().auth.requireUser(currentToken(request));
  const requireCompletedProfileIfSignedIn = async (request: Request) => {
    if (!request.headers.has('cookie')) return;
    const token = currentToken(request);
    if (!token) return;
    try {
      await deps.services().auth.requireUser(token);
    } catch (error) {
      // Public catalog reads also support anonymous and expired sessions.
      if (!(error instanceof AppError && error.status === 401)) throw error;
    }
  };
  const mutation = (request: Request) =>
    assertSameOrigin(request, serverConfig().APP_BASE_URL);
  return {
    live: (request: Request) =>
      api(request, async () => success({ status: 'live' })),
    ready: (request: Request) =>
      api(request, async () => {
        try {
          await deps.ping();
        } catch {
          throw new AppError('NOT_READY', 503, 'Database unavailable');
        }
        return success({ status: 'ready' });
      }),
    login: (request: Request) =>
      api(request, async () => {
        mutation(request);
        const input = parse(loginSchema, await jsonBody(request));
        const config = serverConfig();
        const ttl = config.SESSION_TTL_DAYS * 86400;
        const auth = deps.services().auth;
        const result = await auth.login(input.email, input.password, ttl);
        // Revoke a previous browser session after successful credential verification.
        await auth.logout(currentToken(request));
        const response = success(result.profile);
        response.headers.set(
          'Set-Cookie',
          sessionCookie(
            config.SESSION_COOKIE_NAME,
            result.token,
            ttl,
            config.NODE_ENV === 'production',
          ),
        );
        return response;
      }),
    logout: (request: Request) =>
      api(request, async () => {
        mutation(request);
        await deps.services().auth.logout(currentToken(request));
        const config = serverConfig();
        const response = success({ loggedOut: true });
        response.headers.set(
          'Set-Cookie',
          sessionCookie(
            config.SESSION_COOKIE_NAME,
            '',
            0,
            config.NODE_ENV === 'production',
          ),
        );
        return response;
      }),
    me: (request: Request) =>
      api(request, async () => {
        const { profile } = await deps
          .services()
          .auth.requireSession(currentToken(request));
        return success(profile);
      }),
    categories: (request: Request) =>
      listCategories(
        request,
        () => deps.services().categories,
        requireCompletedProfileIfSignedIn,
      ),
    locations: (request: Request) =>
      listLocations(
        request,
        () => deps.services().locations,
        requireCompletedProfileIfSignedIn,
      ),
    listReports: (request: Request) =>
      listReports(request, requireUser, () => deps.services().reports),
    getReport: (request: Request, context: RouteContext) =>
      getReport(request, context, requireUser, () => deps.services().reports),
    getReportContact: (request: Request, context: RouteContext) =>
      api(request, async () => {
        const user = await requireUser(request);
        const id = parse(idSchema, (await context.params).id);
        const { matchId } = parse(contactQuery, queryInput(request));
        return success(
          await deps.services().reportContacts.read(id, user.userId, matchId),
        );
      }),
    putReportContact: (request: Request, context: RouteContext) =>
      api(request, async () => {
        mutation(request);
        const user = await requireUser(request);
        const id = parse(idSchema, (await context.params).id);
        const preferences = parse(contactPreferences, await jsonBody(request));
        return success(
          await deps
            .services()
            .reportContacts.save(id, user.userId, preferences),
        );
      }),
    createReport: (request: Request) =>
      api(request, async () => {
        mutation(request);
        const user = await requireUser(request);
        const input = parse(reportCreateSchema, await jsonBody(request));
        return success(
          reportDto(await deps.services().reports.create(user.userId, input)),
          201,
        );
      }),
    patchReport: (request: Request, context: RouteContext) =>
      api(request, async () => {
        mutation(request);
        const user = await requireUser(request);
        const id = parse(idSchema, (await context.params).id);
        const input = parse(reportPatchSchema, await jsonBody(request));
        return success(
          reportDto(
            await deps.services().reports.update(id, user.userId, input),
          ),
        );
      }),
    patchReportStatus: (request: Request, context: RouteContext) =>
      updateReportStatus(
        request,
        context,
        requireUser,
        () => deps.services().reports,
        mutation,
      ),
    listOwnedReports: (request: Request) =>
      listOwnedReports(request, requireUser, () => deps.services().reports),
    listClaims: (request: Request) =>
      listClaims(request, requireUser, () => deps.services().claims),
    getClaim: (request: Request, context: RouteContext) =>
      getClaim(request, context, requireUser, () => deps.services().claims),
    createClaim: (request: Request) =>
      api(request, async () => {
        mutation(request);
        const user = await requireUser(request);
        const input = parse(claimCreateSchema, await jsonBody(request));
        return success(
          await deps.services().claims.create(user.userId, input),
          201,
        );
      }),
    patchClaimStatus: (request: Request, context: RouteContext) =>
      updateClaimStatus(
        request,
        context,
        requireUser,
        () => deps.services().claims,
        mutation,
      ),
    confirmClaimHandover: (request: Request, context: RouteContext) =>
      api(request, async () => {
        mutation(request);
        const user = await requireUser(request);
        const id = parse(idSchema, (await context.params).id);
        parse(claimHandoverSchema, await jsonBody(request));
        return success(
          await deps.services().claims.confirmHandover(id, user.userId),
          200,
        );
      }),
    listReportClaims: (request: Request, context: RouteContext) =>
      listReportClaims(
        request,
        context,
        requireUser,
        () => deps.services().claims,
      ),
  };
}
export const handlers = createHandlers();
