import 'server-only';
import { AppError } from '@campus/shared';
import { api } from '@/lib/http/api';
import type { CategoryService } from '../application/category-service';

// BE002: implement validation, service invocation and the documented response.
export function listCategories(
  request: Request,
  _getService: () => CategoryService,
) {
  return api(request, async () => {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE002 is awaiting implementation',
    );
  });
}
