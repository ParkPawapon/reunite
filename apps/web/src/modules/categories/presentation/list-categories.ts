import 'server-only';
import {
  api,
  parse,
  paginationSchema,
  queryInput,
  success,
} from '@/lib/http/api';
import type { CategoryService } from '../application/category-service';

export function listCategories(
  request: Request,
  getService: () => CategoryService,
) {
  return api(request, async () => {
    const page = parse(paginationSchema.strict(), queryInput(request));
    const categories = await getService().list(page);
    return success(categories, 200, page);
  });
}
