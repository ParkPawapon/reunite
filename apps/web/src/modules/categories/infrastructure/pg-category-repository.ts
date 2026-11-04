import 'server-only';
import { query, type Sql } from '@campus/database';
import type { Page } from '@campus/shared';
import type { CategoryRepository } from '../domain/category';

export class PgCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Sql) {}
  async list(page: Page) {
    const rows = await query<{ category_id: number; category_name: string }>(
      this.db,
      'SELECT category_id, category_name FROM categories ORDER BY category_id ASC LIMIT $1 OFFSET $2',
      [page.limit, page.offset],
    );
    return rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
    }));
  }
}
