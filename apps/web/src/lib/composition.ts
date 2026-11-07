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
import { ProfileService } from '@/modules/users/application/profile-service';
import { PgProfileRepository } from '@/modules/users/infrastructure/pg-profile-repository';
import { NotificationService } from '@/modules/notifications/application/notification-service';
import { PgNotificationRepository } from '@/modules/notifications/infrastructure/pg-notification-repository';
import { AppError } from '@campus/shared';

// Explicit composition root. Each use case receives its port; no app dependency in the DB package.
export function createServices(db: Sql) {
  const authRepository = new PgAuthRepository(db);
  return {
    auth: new AuthService(authRepository, authCryptography),
    profile: new ProfileService(
      new PgProfileRepository(db),
      async (userId, hash, password) => {
        if (
          !(await authRepository.consumeLoginAttempt(
            authCryptography.digest(`profile:${userId}`),
          ))
        )
          throw new AppError(
            'RATE_LIMITED',
            429,
            'Too many attempts; retry after 15 minutes',
          );
        return authCryptography.verify(hash, password);
      },
    ),
    notifications: new NotificationService(new PgNotificationRepository(db)),
    reports: new ReportService(new PgReportRepository(db)),
    claims: new ClaimService(new PgClaimRepository(db)),
    categories: createCategoryService(db),
    locations: createLocationService(db),
  };
}
export const services = () => createServices(getPool());
