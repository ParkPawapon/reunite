import 'server-only';
import {
  api,
  parse,
  paginationSchema,
  queryInput,
  success,
} from '@/lib/http/api';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ReportService } from '../application/report-service';
import { reportDto } from './dto';

export function listOwnedReports(
  request: Request,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ReportService,
) {
  return api(request, async () => {
    const user = await requireUser(request);
    const page = parse(paginationSchema.strict(), queryInput(request));
    const reports = await getService().listOwned(user.userId, page);
    return success(reports.map(reportDto), 200, page);
  });
}
