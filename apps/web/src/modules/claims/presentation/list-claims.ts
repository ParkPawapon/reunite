import 'server-only';
import {
  api,
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
    const page = parse(paginationSchema.strict(), queryInput(request));
    const claims = await getService().list(user.userId, page);
    return success(claims, 200, page);
  });
}
