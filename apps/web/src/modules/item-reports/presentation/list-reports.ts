import 'server-only';
import { api, parse, queryInput, success } from '@/lib/http/api';
import type { ReportService } from '../application/report-service';
import { reportDto } from './dto';
import { reportFilterSchema } from './schemas';

export function listReports(request: Request, getService: () => ReportService) {
  return api(request, async () => {
    const filter = parse(reportFilterSchema, queryInput(request));
    const reports = await getService().list(filter);
    return success(reports.map(reportDto), 200, {
      limit: filter.limit,
      offset: filter.offset,
    });
  });
}
