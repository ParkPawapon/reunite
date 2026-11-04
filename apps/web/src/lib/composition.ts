import 'server-only';
import { getPool, type Sql } from '@campus/database';
import { AuthService } from '@/modules/auth/application/auth-service';
import { PgAuthRepository } from '@/modules/auth/infrastructure/pg-auth-repository';
import { authCryptography } from '@/modules/auth/infrastructure/cryptography';
import { ReportService } from '@/modules/item-reports/application/report-service';
import { PgReportRepository } from '@/modules/item-reports/infrastructure/pg-report-repository';
import { ClaimService } from '@/modules/claims/application/claim-service';
import { PgClaimRepository } from '@/modules/claims/infrastructure/pg-claim-repository';
import { CategoryService } from '@/modules/categories/application/category-service';
import { PgCategoryRepository } from '@/modules/categories/infrastructure/pg-category-repository';
import { LocationService } from '@/modules/locations/application/location-service';
import { PgLocationRepository } from '@/modules/locations/infrastructure/pg-location-repository';

// Explicit composition root. Each use case receives its port; no app dependency in the DB package.
export function createServices(db: Sql) {
  return {
    auth: new AuthService(new PgAuthRepository(db), authCryptography),
    reports: new ReportService(new PgReportRepository(db)),
    claims: new ClaimService(new PgClaimRepository(db)),
    categories: new CategoryService(new PgCategoryRepository(db)),
    locations: new LocationService(new PgLocationRepository(db)),
  };
}
export const services = () => createServices(getPool());
