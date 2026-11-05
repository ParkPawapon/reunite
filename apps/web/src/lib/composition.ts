import 'server-only';
import { getPool, type Sql } from '@campus/database';
import { AuthService } from '@/modules/auth/application/auth-service';
import { PgAuthRepository } from '@/modules/auth/infrastructure/pg-auth-repository';
import { authCryptography } from '@/modules/auth/infrastructure/cryptography';
import { ReportService } from '@/modules/item-reports/application/report-service';
import { PgReportRepository } from '@/modules/item-reports/infrastructure/pg-report-repository';
import { ClaimService } from '@/modules/claims/application/claim-service';
import { PgClaimRepository } from '@/modules/claims/infrastructure/pg-claim-repository';
import { createCategoryService } from '@/modules/categories/composition';
import { createLocationService } from '@/modules/locations/composition';

// Explicit composition root. Each use case receives its port; no app dependency in the DB package.
export function createServices(db: Sql) {
  return {
    auth: new AuthService(new PgAuthRepository(db), authCryptography),
    reports: new ReportService(new PgReportRepository(db)),
    claims: new ClaimService(new PgClaimRepository(db)),
    categories: createCategoryService(db),
    locations: createLocationService(db),
  };
}
export const services = () => createServices(getPool());
