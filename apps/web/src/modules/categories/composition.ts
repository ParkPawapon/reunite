import 'server-only';
import type { Sql } from '@campus/database';
import { AppError } from '@campus/shared';
import type { CategoryService } from './application/category-service';

// BE002 owns this factory; replace the placeholder with the real dependencies.
export function createCategoryService(_db: Sql): CategoryService {
  return {
    async list() {
      throw new AppError(
        'NOT_IMPLEMENTED',
        501,
        'BE002 is awaiting implementation',
      );
    },
  };
}
