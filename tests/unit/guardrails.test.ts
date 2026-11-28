import { expect, it, vi } from 'vitest';
import { ReportService } from '@/modules/item-reports/application/report-service';
import type { ReportRepository } from '@/modules/item-reports/domain/report';
import { ClaimService } from '@/modules/claims/application/claim-service';
import type { ClaimRepository } from '@/modules/claims/domain/claim';
import { AuthService } from '@/modules/auth/application/auth-service';
import type { AuthRepository } from '@/modules/auth/domain/auth';
import { validateHistory } from '../../packages/database/src/migrations';

it('stops a throttled login before credential lookup or password hashing', async () => {
  const repository: AuthRepository = {
    consumeLoginAttempt: async () => false,
    findCredentials: vi.fn(),
    findOrCreateMicrosoftUser: vi.fn(),
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

it('rejects non-owner or missing report update with 404', async () => {
  const repository: ReportRepository = {
    list: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    updateOwned: vi.fn(async () => null),
    updateStatusOwned: vi.fn(),
    listOwned: vi.fn(),
  };
  await expect(
    new ReportService(repository).update(1, 2, { title: 'Stolen edit' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  expect(repository.updateOwned).toHaveBeenCalledWith(1, 2, {
    title: 'Stolen edit',
  });
});
it('BE005 uses its domain repository contract', async () => {
  const rows: Awaited<ReturnType<ReportRepository['list']>> = [];
  const list = vi.fn<ReportRepository['list']>().mockResolvedValue(rows);
  const service = new ReportService({
    ...{
      list: vi.fn(),
      create: vi.fn(),
      find: vi.fn(),
      updateOwned: vi.fn(),
      updateStatusOwned: vi.fn(),
      listOwned: vi.fn(),
    },
    list,
  });
  const filter = { limit: 20, offset: 0, type: 'FOUND' as const };
  expect(await service.list(filter)).toBe(rows);
  expect(list).toHaveBeenCalledExactlyOnceWith(filter);
});
it('BE006 uses its domain repository contract', async () => {
  const row = {
    reportId: 7,
    userId: 4,
    publisher: {
      name: 'Report publisher',
      email: 'owner@example.test',
      phone: null,
    },
    categoryId: 1,
    locationId: 2,
    type: 'FOUND' as const,
    title: 'Test report',
    description: null,
    image: null,
    eventDatetime: '2026-11-04T05:30:00.000Z',
    status: 'OPEN' as const,
    createdAt: '2026-11-04T06:00:00.000Z',
    updatedAt: '2026-11-04T06:00:00.000Z',
  };
  const find = vi
    .fn<ReportRepository['find']>()
    .mockResolvedValueOnce(row)
    .mockResolvedValueOnce(null);
  const service = new ReportService({
    ...{
      list: vi.fn(),
      create: vi.fn(),
      find: vi.fn(),
      updateOwned: vi.fn(),
      updateStatusOwned: vi.fn(),
      listOwned: vi.fn(),
    },
    find,
  });
  expect(await service.find(7)).toBe(row);
  await expect(service.find(9)).rejects.toMatchObject({
    code: 'NOT_FOUND',
    status: 404,
    message: 'Report not found',
  });
  expect(find.mock.calls).toEqual([[7], [9]]);
});
it('BE007 uses its domain repository contract', async () => {
  const rows: Awaited<ReturnType<ClaimRepository['listOwned']>> = [];
  const listOwned = vi
    .fn<ClaimRepository['listOwned']>()
    .mockResolvedValue(rows);
  const service = new ClaimService({
    ...{
      listOwned: vi.fn(),
      create: vi.fn(),
      findOwned: vi.fn(),
      reviewReportClaim: vi.fn(),
      listForReportOwner: vi.fn(),
    },
    listOwned,
  });
  const page = { limit: 20, offset: 0 };
  expect(await service.list(4, page)).toBe(rows);
  expect(listOwned).toHaveBeenCalledExactlyOnceWith(4, page);
});
it('BE008 uses its domain repository contract', async () => {
  const row = {
    claimId: 8,
    reportId: 7,
    userId: 4,
    evidence: 'Synthetic private receipt',
    status: 'PENDING' as const,
    claimDate: '2026-11-04T06:00:00.000Z',
    updatedAt: '2026-11-04T06:00:00.000Z',
  };
  const findOwned = vi
    .fn<ClaimRepository['findOwned']>()
    .mockResolvedValueOnce(row)
    .mockResolvedValueOnce(null);
  const service = new ClaimService({
    ...{
      listOwned: vi.fn(),
      create: vi.fn(),
      findOwned: vi.fn(),
      reviewReportClaim: vi.fn(),
      listForReportOwner: vi.fn(),
    },
    findOwned,
  });
  expect(await service.find(8, 4)).toBe(row);
  await expect(service.find(9, 4)).rejects.toMatchObject({
    code: 'NOT_FOUND',
    status: 404,
    message: 'Claim not found',
  });
  expect(findOwned.mock.calls).toEqual([
    [8, 4],
    [9, 4],
  ]);
});
it('BE009 uses its domain repository contract', async () => {
  const row = {
    reportId: 9,
    userId: 2,
    categoryId: 1,
    locationId: 1,
    type: 'LOST' as const,
    title: 'Updated status report',
    description: null,
    image: null,
    eventDatetime: '2026-11-04T06:00:00.000Z',
    status: 'RESOLVED' as const,
    createdAt: '2026-11-04T06:00:00.000Z',
    updatedAt: '2026-11-04T06:00:00.000Z',
  };
  const updateStatusOwned = vi
    .fn<ReportRepository['updateStatusOwned']>()
    .mockResolvedValueOnce(row)
    .mockResolvedValueOnce(null);
  const service = new ReportService({
    ...{
      list: vi.fn(),
      create: vi.fn(),
      find: vi.fn(),
      updateOwned: vi.fn(),
      updateStatusOwned: vi.fn(),
      listOwned: vi.fn(),
    },
    updateStatusOwned,
  });
  expect(await service.updateStatus(9, 2, 'RESOLVED')).toBe(row);
  await expect(service.updateStatus(10, 2, 'CLOSED')).rejects.toMatchObject({
    code: 'NOT_FOUND',
    status: 404,
    message: 'Report not found',
  });
  expect(updateStatusOwned.mock.calls).toEqual([
    [9, 2, 'RESOLVED'],
    [10, 2, 'CLOSED'],
  ]);
});
it('BE010 uses its domain repository contract', async () => {
  const row = {
    claimId: 10,
    reportId: 5,
    userId: 3,
    evidence: 'Evidence',
    status: 'APPROVED' as const,
    resolutionNote: 'Approved match',
    resolvedBy: 2,
    claimDate: '2026-11-04T06:00:00.000Z',
    updatedAt: '2026-11-04T06:00:00.000Z',
  };
  const reviewReportClaim = vi
    .fn<ClaimRepository['reviewReportClaim']>()
    .mockResolvedValueOnce(row)
    .mockResolvedValueOnce(null);
  const service = new ClaimService({
    ...{
      listOwned: vi.fn(),
      create: vi.fn(),
      findOwned: vi.fn(),
      reviewReportClaim: vi.fn(),
      listForReportOwner: vi.fn(),
    },
    reviewReportClaim,
  });
  const decision = {
    status: 'APPROVED' as const,
    resolutionNote: 'Approved match',
  };
  expect(await service.updateStatus(10, 2, decision)).toBe(row);
  await expect(service.updateStatus(11, 2, decision)).rejects.toMatchObject({
    code: 'NOT_FOUND',
    status: 404,
    message: 'Claim not found',
  });
  expect(reviewReportClaim.mock.calls).toEqual([
    [10, 2, decision],
    [11, 2, decision],
  ]);
});
it('BE011 uses its domain repository contract', async () => {
  const rows: Awaited<ReturnType<ReportRepository['listOwned']>> = [];
  const listOwned = vi
    .fn<ReportRepository['listOwned']>()
    .mockResolvedValue(rows);
  const service = new ReportService({
    ...{
      list: vi.fn(),
      create: vi.fn(),
      find: vi.fn(),
      updateOwned: vi.fn(),
      updateStatusOwned: vi.fn(),
      listOwned: vi.fn(),
    },
    listOwned,
  });
  const page = { limit: 20, offset: 0 };
  expect(await service.listOwned(2, page)).toBe(rows);
  expect(listOwned).toHaveBeenCalledExactlyOnceWith(2, page);
});
it('BE012 uses its domain repository contract', async () => {
  const rows: Awaited<ReturnType<ClaimRepository['listForReportOwner']>> = [];
  const listForReportOwner = vi
    .fn<ClaimRepository['listForReportOwner']>()
    .mockResolvedValue(rows);
  const service = new ClaimService({
    ...{
      listOwned: vi.fn(),
      create: vi.fn(),
      findOwned: vi.fn(),
      reviewReportClaim: vi.fn(),
      listForReportOwner: vi.fn(),
    },
    listForReportOwner,
  });
  const page = { limit: 20, offset: 0 };
  expect(await service.listForReport(5, 2, page)).toBe(rows);
  expect(listForReportOwner).toHaveBeenCalledExactlyOnceWith(5, 2, page);
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
