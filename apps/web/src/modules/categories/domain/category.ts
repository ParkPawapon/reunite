import type { Page } from '@campus/shared';
export type Category = { categoryId: number; categoryName: string };
export interface CategoryRepository {
  list(page: Page): Promise<Category[]>;
}
