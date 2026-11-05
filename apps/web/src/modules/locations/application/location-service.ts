import type { Page } from '@campus/shared';
import type { Location } from '../domain/location';

// BE003: retain the contract; the assignee implements the application service.
export interface LocationService {
  list(page: Page): Promise<Location[]>;
}
