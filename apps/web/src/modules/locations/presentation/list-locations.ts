import 'server-only';
import { AppError } from '@campus/shared';
import { api } from '@/lib/http/api';
import type { LocationService } from '../application/location-service';

// BE003: implement validation, service invocation and the documented response.
export function listLocations(
  request: Request,
  _getService: () => LocationService,
) {
  return api(request, async () => {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE003 is awaiting implementation',
    );
  });
}
