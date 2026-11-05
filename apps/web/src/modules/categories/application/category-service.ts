import type { Page } from '@campus/shared';
import type { Category } from '../domain/category';

// BE002: retain the contract; the assignee implements the application service.
export interface CategoryService {
  list(page: Page): Promise<Category[]>;
}
