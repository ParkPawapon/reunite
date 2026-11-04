import type { Page } from '@campus/shared';
import type { CategoryRepository } from '../domain/category';
export class CategoryService {
  constructor(private readonly repository: CategoryRepository) {}
  list(page: Page) {
    return this.repository.list(page);
  }
}
