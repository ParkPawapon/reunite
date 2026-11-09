import type { Page } from '@campus/shared';
import type { Category, CategoryRepository } from '../domain/category';

export interface CategoryService {
  list(page: Page): Promise<Category[]>;
}

export class DefaultCategoryService implements CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) { }

  async list(page: Page): Promise<Category[]> {
    return this.categoryRepository.list(page);
  }
}
