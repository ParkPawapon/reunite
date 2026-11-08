import 'server-only';
import { AppError } from '@campus/shared';
import { api } from '@/lib/http/api';
import type { RouteContext } from '@/lib/http/handlers';
import type { ReportService } from '../application/report-service';

// BE006: implement route id validation, service invocation and the documented response.
export function getReport(
  request: Request,
  _context: RouteContext,
  _getService: () => ReportService,
) {
  return api(request, async () => {
    throw new AppError(
      'NOT_IMPLEMENTED',
      501,
      'BE006 is awaiting implementation',
    );
  });
}
