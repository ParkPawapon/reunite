import 'server-only';
import type { Sql } from '@campus/database';
import type { CategoryService } from './application/category-service';
import { DefaultCategoryService } from './application/category-service';
import { PgCategoryRepository } from './infrastructure/pg-category-repository';

export function createCategoryService(db: Sql): CategoryService {
  const categoryRepository = new PgCategoryRepository(db);
  return new DefaultCategoryService(categoryRepository);
}
