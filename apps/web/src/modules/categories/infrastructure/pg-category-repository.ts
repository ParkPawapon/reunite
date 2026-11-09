import 'server-only';
import { query, type Sql } from '@campus/database';
import type { Page } from '@campus/shared';
import type { Category, CategoryRepository } from '../domain/category';

type Row = {
  category_id: number;
  category_name: string;
};

export class PgCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Sql) {}

  async list(page: Page): Promise<Category[]> {
    const rows = await query<Row>(
      this.db,
      `SELECT category_id, category_name FROM categories
       ORDER BY category_id ASC LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    return rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
    }));
  }
}
