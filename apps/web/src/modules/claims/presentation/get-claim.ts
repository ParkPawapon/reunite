import 'server-only';
import { AppError } from '@campus/shared';
import { api } from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ClaimService } from '../application/claim-service';

// BE008: implement session authentication, route id validation, service invocation and the documented response.
export function getClaim(
  request: Request,
  _context: RouteContext,
  _requireUser: (request: Request) => Promise<UserProfile>,
  _getService: () => ClaimService,
) {
  return api(request, async () => {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE008 is awaiting implementation',
    );
  });
}
