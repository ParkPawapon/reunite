import { handlers, type RouteContext } from '@/lib/http/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request, context: RouteContext) =>
  handlers.listReportClaims(request, context);
