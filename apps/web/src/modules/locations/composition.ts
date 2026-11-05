import 'server-only';
import type { Sql } from '@campus/database';
import { AppError } from '@campus/shared';
import type { LocationService } from './application/location-service';

// BE003 owns this factory; replace the placeholder with the real dependencies.
export function createLocationService(_db: Sql): LocationService {
  return {
    async list() {
      throw new AppError(
        'NOT_IMPLEMENTED',
        501,
        'BE003 is awaiting implementation',
      );
    },
  };
}
