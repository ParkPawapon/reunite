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
  authorize?: (request: Request) => Promise<void>,
) {
  return api(request, async () => {
    await authorize?.(request);
    const page = parse(paginationSchema.strict(), queryInput(request));
    const locations = await getService().list(page);
    return success(locations, 200, page);
  });
}
