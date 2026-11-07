import 'server-only';
import type { Sql } from '@campus/database';
import { LocationService } from './application/location-service';
import { PgLocationRepository } from './infrastructure/pg-location-repository';

export function createLocationService(db: Sql): LocationService {
  return new LocationService(new PgLocationRepository(db));
}
