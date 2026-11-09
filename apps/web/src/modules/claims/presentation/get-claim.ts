import 'server-only';
import { api, idSchema, parse, success } from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ClaimService } from '../application/claim-service';

export function getClaim(
  request: Request,
  context: RouteContext,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ClaimService,
) {
  return api(request, async () => {
    const user = await requireUser(request);
    const id = parse(idSchema, (await context.params).id);
    const claim = await getService().find(id, user.userId);
    return success(claim, 200);
  });
}
