import { expect, it, vi } from 'vitest';
import { ReportService } from '@/modules/item-reports/application/report-service';
import type { ReportRepository } from '@/modules/item-reports/domain/report';
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

it('rejects non-owner or missing report update with 404', async () => {
  const repository: ReportRepository = {
    list: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    updateOwned: vi.fn(async () => null),
  };
  await expect(
    new ReportService(repository).update(1, 2, { title: 'Stolen edit' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  expect(repository.updateOwned).toHaveBeenCalledWith(1, 2, {
    title: 'Stolen edit',
  });
});
it('exposes explicit 501 placeholders for BE005-BE008 report and claim read services', async () => {
  const reportService = new ReportService({
    list: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    updateOwned: vi.fn(),
  });
  const claimService = new ClaimService({
    listOwned: vi.fn(),
    create: vi.fn(),
    findOwned: vi.fn(),
  });
  await expect(
    reportService.list({ limit: 20, offset: 0 }),
  ).rejects.toMatchObject({
    code: 'NOT_IMPLEMENTED',
    status: 501,
    message: 'BE005 is awaiting implementation',
  });
  await expect(reportService.find(1)).rejects.toMatchObject({
    code: 'NOT_IMPLEMENTED',
    status: 501,
    message: 'BE006 is awaiting implementation',
  });
  await expect(
    claimService.list(1, { limit: 20, offset: 0 }),
  ).rejects.toMatchObject({
    code: 'NOT_IMPLEMENTED',
    status: 501,
    message: 'BE007 is awaiting implementation',
  });
  await expect(claimService.find(1, 2)).rejects.toMatchObject({
    code: 'NOT_IMPLEMENTED',
    status: 501,
    message: 'BE008 is awaiting implementation',
  });
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
