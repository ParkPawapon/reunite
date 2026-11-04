import type { Page } from '@campus/shared';
import type { LocationRepository } from '../domain/location';
export class LocationService {
  constructor(private readonly repository: LocationRepository) {}
  list(page: Page) {
    return this.repository.list(page);
  }
}
