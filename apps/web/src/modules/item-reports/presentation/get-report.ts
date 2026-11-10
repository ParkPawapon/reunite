import 'server-only';
import { api, idSchema, parse, success } from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { ReportService } from '../application/report-service';
import { reportDto } from './dto';

export function getReport(
  request: Request,
  context: RouteContext,
  getService: () => ReportService,
) {
  return api(request, async () => {
    const id = parse(idSchema, (await context.params).id);
    const report = await getService().find(id);
    return success(reportDto(report), 200);
  });
}
