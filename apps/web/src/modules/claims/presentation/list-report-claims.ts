import 'server-only';
import {
  api,
  idSchema,
  paginationSchema,
  parse,
  queryInput,
  success,
} from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ClaimService } from '../application/claim-service';

export function listReportClaims(
  request: Request,
  context: RouteContext,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ClaimService,
) {
  return api(request, async () => {
    const user = await requireUser(request);
    const reportId = parse(idSchema, (await context.params).id);
    const page = parse(paginationSchema.strict(), queryInput(request));
    const claims = await getService().listForReport(
      reportId,
      user.userId,
      page,
    );
    return success(claims, 200, page);
  });
}
