import 'server-only';
import {
  api,
  idSchema,
  parse,
  paginationSchema,
  queryInput,
  success,
} from '@/lib/http/api';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ClaimService } from '../application/claim-service';

export function listClaims(
  request: Request,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ClaimService,
) {
  return api(request, async () => {
    const user = await requireUser(request);
    const filter = parse(
      paginationSchema.extend({ reportId: idSchema.optional() }).strict(),
      queryInput(request),
    );
    const claims = await getService().list(user.userId, filter);
    return success(claims, 200, { limit: filter.limit, offset: filter.offset });
  });
}
