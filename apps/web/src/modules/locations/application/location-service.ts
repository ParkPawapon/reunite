import type { Page } from '@campus/shared';
import type { Location, LocationRepository } from '../domain/location';

export class LocationService {
  constructor(private readonly repository: LocationRepository) {}

  list(page: Page): Promise<Location[]> {
    return this.repository.list(page);
  }
}
