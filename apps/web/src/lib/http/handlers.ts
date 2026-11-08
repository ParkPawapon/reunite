import 'server-only';
import { getPool } from '@campus/database';
import { AppError } from '@campus/shared';
import { services, type createServices } from '@/lib/composition';
import { serverConfig } from '@/config/server';
import { assertSameOrigin } from '@/lib/security/origin';
import { readSessionToken, sessionCookie } from '@/lib/security/session';
import { api, jsonBody, parse, success, idSchema } from './api';
import { loginSchema } from '@/modules/auth/presentation/schemas';
import {
  reportCreateSchema,
  reportPatchSchema,
} from '@/modules/item-reports/presentation/schemas';
import { reportDto } from '@/modules/item-reports/presentation/dto';
import { listReports } from '@/modules/item-reports/presentation/list-reports';
import { getReport } from '@/modules/item-reports/presentation/get-report';
import { claimCreateSchema } from '@/modules/claims/presentation/schemas';
import { listClaims } from '@/modules/claims/presentation/list-claims';
import { getClaim } from '@/modules/claims/presentation/get-claim';
import { listCategories } from '@/modules/categories/presentation/list-categories';
import { listLocations } from '@/modules/locations/presentation/list-locations';

export type RouteContext = { params: Promise<{ id: string }> };
type Services = ReturnType<typeof createServices>;
type Dependencies = { services: () => Services; ping: () => Promise<void> };
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
      api(request, async () => success(await requireUser(request))),
    categories: (request: Request) =>
      listCategories(request, () => deps.services().categories),
    locations: (request: Request) =>
      listLocations(request, () => deps.services().locations),
    listReports: (request: Request) =>
      listReports(request, () => deps.services().reports),
    getReport: (request: Request, context: RouteContext) =>
      getReport(request, context, () => deps.services().reports),
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
  };
}
export const handlers = createHandlers();
