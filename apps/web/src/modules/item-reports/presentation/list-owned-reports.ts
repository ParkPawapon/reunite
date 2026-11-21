import 'server-only';
import { api, parse, queryInput, success } from '@/lib/http/api';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ReportService } from '../application/report-service';
import { reportDto } from './dto';
import { reportBrowseSchema } from './schemas';

export function listOwnedReports(
  request: Request,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ReportService,
) {
  return api(request, async () => {
    const user = await requireUser(request);
    const filter = parse(reportBrowseSchema, queryInput(request));
    const reports = await getService().listOwned(user.userId, filter);
    return success(reports.map(reportDto), 200, {
      limit: filter.limit,
      offset: filter.offset,
    });
  });
}
