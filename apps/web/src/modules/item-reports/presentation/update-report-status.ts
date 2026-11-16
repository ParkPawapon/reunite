import 'server-only';
import { api, idSchema, jsonBody, parse, success } from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { UserProfile } from '@/modules/users/domain/user';
import type { ReportService } from '../application/report-service';
import { reportDto } from './dto';
import { reportStatusPatchSchema } from './schemas';

export function updateReportStatus(
  request: Request,
  context: RouteContext,
  requireUser: (request: Request) => Promise<UserProfile>,
  getService: () => ReportService,
  mutation?: (request: Request) => void,
) {
  return api(request, async () => {
    mutation?.(request);
    const user = await requireUser(request);
    const id = parse(idSchema, (await context.params).id);
    const input = parse(reportStatusPatchSchema, await jsonBody(request));
    const report = await getService().updateStatus(
      id,
      user.userId,
      input.status,
    );
    return success(reportDto(report), 200);
  });
}
