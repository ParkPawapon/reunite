import 'server-only';
import { AppError } from '@campus/shared';
import { api } from '@/lib/http/api';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ClaimService } from '../application/claim-service';

// BE007: implement session authentication, pagination validation, service invocation and the documented response.
export function listClaims(
  request: Request,
  _requireUser: (request: Request) => Promise<UserProfile>,
  _getService: () => ClaimService,
) {
  return api(request, async () => {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE007 is awaiting implementation',
    );
  });
}
