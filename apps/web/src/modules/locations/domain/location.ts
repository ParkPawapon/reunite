import type { Page } from '@campus/shared';
export type Location = {
  locationId: number;
  locationName: string;
  detail: string | null;
};
export interface LocationRepository {
  list(page: Page): Promise<Location[]>;
}
