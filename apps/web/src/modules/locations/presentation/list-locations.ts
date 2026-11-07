import 'server-only';
import {
  api,
  parse,
  paginationSchema,
  queryInput,
  success,
} from '@/lib/http/api';
import type { LocationService } from '../application/location-service';

export function listLocations(
  request: Request,
  getService: () => LocationService,
) {
  return api(request, async () => {
    const page = parse(paginationSchema.strict(), queryInput(request));
    const locations = await getService().list(page);
    return success(locations, 200, page);
  });
}
