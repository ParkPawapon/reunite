import 'server-only';
import { api, parse, queryInput, success } from '@/lib/http/api';
import type { ReportService } from '../application/report-service';
import { reportDto } from './dto';
import { reportFilterSchema } from './schemas';
import type { UserProfile } from '@/modules/users/domain/user';

export function listReports(
  request: Request,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ReportService,
) {
  return api(request, async () => {
    await requireUser(request);
    const filter = parse(reportFilterSchema, queryInput(request));
    const reports = await getService().list(filter);
    return success(reports.map(reportDto), 200, {
      limit: filter.limit,
      offset: filter.offset,
    });
  });
}
