import 'server-only';
import { AppError } from '@campus/shared';
import { api } from '@/lib/http/api';
import type { ReportService } from '../application/report-service';

// BE005: implement query filter validation, service invocation and the documented response.
export function listReports(
  request: Request,
  _getService: () => ReportService,
) {
  return api(request, async () => {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE005 is awaiting implementation',
    );
  });
}
