import 'server-only';
import { api, idSchema, parse, success } from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { ReportService } from '../application/report-service';
import { reportDto } from './dto';
import type { UserProfile } from '@/modules/users/domain/user';

export function getReport(
  request: Request,
  context: RouteContext,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ReportService,
) {
  return api(request, async () => {
    const user = await requireUser(request);
    const id = parse(idSchema, (await context.params).id);
    const report = await getService().find(id);
    return success({
      ...reportDto(report),
      isOwner: report.userId === user.userId,
      publisher: report.publisher,
    });
  });
}
