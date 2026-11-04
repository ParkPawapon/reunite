import { expect, it, vi } from 'vitest';
import { ReportService } from '@/modules/item-reports/application/report-service';
import type {
  ReportRepository,
  Report,
} from '@/modules/item-reports/domain/report';
import { ClaimService } from '@/modules/claims/application/claim-service';
import { AuthService } from '@/modules/auth/application/auth-service';
import type { AuthRepository } from '@/modules/auth/domain/auth';
import { validateHistory } from '../../packages/database/src/migrations';

it('stops a throttled login before credential lookup or password hashing', async () => {
  const repository: AuthRepository = {
    consumeLoginAttempt: async () => false,
    findCredentials: vi.fn(),
    createSession: vi.fn(),
    findSession: vi.fn(),
    revokeSession: vi.fn(),
  };
  const verify = vi.fn();
  const service = new AuthService(repository, {
    verify,
    token: vi.fn(),
    digest: () => 'account digest',
  });
  await expect(
    service.login('account@example.test', 'password', 60),
  ).rejects.toMatchObject({ status: 429 });
  expect(repository.findCredentials).not.toHaveBeenCalled();
  expect(verify).not.toHaveBeenCalled();
});

it('rejects non-owner update before attempting a write', async () => {
  const report: Report = {
    reportId: 1,
    userId: 1,
    categoryId: 1,
    locationId: 1,
    type: 'LOST',
    status: 'OPEN',
    title: 'Bag',
    description: null,
    image: null,
    eventDatetime: '2026-11-04T00:00:00Z',
    createdAt: '2026-11-04T01:00:00Z',
    updatedAt: '2026-11-04T01:00:00Z',
  };
  const repository: ReportRepository = {
    list: vi.fn(),
    create: vi.fn(),
    find: async () => report,
    updateOwned: vi.fn(),
  };
  await expect(
    new ReportService(repository).update(1, 2, { title: 'Stolen edit' }),
  ).rejects.toMatchObject({ status: 404 });
  expect(repository.updateOwned).not.toHaveBeenCalled();
});
it('returns non-disclosing 404 for unavailable private claims', async () => {
  const service = new ClaimService({
    listOwned: vi.fn(),
    create: vi.fn(),
    findOwned: async () => null,
  });
  await expect(service.find(1, 2)).rejects.toMatchObject({ status: 404 });
});
it('rejects migration checksum changes, gaps, unknown versions and duplicates', () => {
  const files = [
    { version: '0001', checksum: 'one', sql: '' },
    { version: '0002', checksum: 'two', sql: '' },
  ];
  expect(() =>
    validateHistory(files, [{ version: '0001', checksum: 'changed' }]),
  ).toThrow('drift');
  expect(() =>
    validateHistory(files, [{ version: '0002', checksum: 'two' }]),
  ).toThrow('drift');
  expect(() =>
    validateHistory(files, [{ version: '0000', checksum: 'unknown' }]),
  ).toThrow('drift');
  expect(() =>
    validateHistory(
      [files[0], files[0]].filter((f) => f !== undefined),
      [],
    ),
  ).toThrow('unique');
});
