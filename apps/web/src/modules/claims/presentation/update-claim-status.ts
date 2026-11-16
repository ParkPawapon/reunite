import 'server-only';
import { api, idSchema, jsonBody, parse, success } from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ClaimService } from '../application/claim-service';
import { claimStatusPatchSchema } from './schemas';

export function updateClaimStatus(
  request: Request,
  context: RouteContext,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ClaimService,
  mutation?: (request: Request) => void,
) {
  return api(request, async () => {
    mutation?.(request);
    const user = await requireUser(request);
    const id = parse(idSchema, (await context.params).id);
    const input = parse(claimStatusPatchSchema, await jsonBody(request));
    const claim = await getService().updateStatus(id, user.userId, input);
    return success(claim, 200);
  });
}
