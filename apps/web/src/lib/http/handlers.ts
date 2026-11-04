import 'server-only';
import { getPool } from '@campus/database';
import { AppError } from '@campus/shared';
import { services, type createServices } from '@/lib/composition';
import { serverConfig } from '@/config/server';
import { assertSameOrigin } from '@/lib/security/origin';
import { readSessionToken, sessionCookie } from '@/lib/security/session';
import {
  api,
  jsonBody,
  parse,
  queryInput,
  success,
  idSchema,
  paginationSchema,
} from './api';
import { loginSchema } from '@/modules/auth/presentation/schemas';
import {
  reportCreateSchema,
  reportFilterSchema,
  reportPatchSchema,
} from '@/modules/item-reports/presentation/schemas';
import { reportDto } from '@/modules/item-reports/presentation/dto';
import { claimCreateSchema } from '@/modules/claims/presentation/schemas';

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
  const page = (request: Request) =>
    parse(paginationSchema.strict(), queryInput(request));
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
      api(request, async () => {
        const pagination = page(request);
        return success(
          await deps.services().categories.list(pagination),
          200,
          pagination,
        );
      }),
    locations: (request: Request) =>
      api(request, async () => {
        const pagination = page(request);
        return success(
          await deps.services().locations.list(pagination),
          200,
          pagination,
        );
      }),
    listReports: (request: Request) =>
      api(request, async () => {
        const filter = parse(reportFilterSchema, queryInput(request));
        return success(
          (await deps.services().reports.list(filter)).map(reportDto),
          200,
          { limit: filter.limit, offset: filter.offset },
        );
      }),
    getReport: (request: Request, context: RouteContext) =>
      api(request, async () =>
        success(
          reportDto(
            await deps
              .services()
              .reports.find(parse(idSchema, (await context.params).id)),
          ),
        ),
      ),
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
      api(request, async () => {
        const user = await requireUser(request);
        const pagination = page(request);
        return success(
          await deps.services().claims.list(user.userId, pagination),
          200,
          pagination,
        );
      }),
    getClaim: (request: Request, context: RouteContext) =>
      api(request, async () => {
        const user = await requireUser(request);
        return success(
          await deps
            .services()
            .claims.find(
              parse(idSchema, (await context.params).id),
              user.userId,
            ),
        );
      }),
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
