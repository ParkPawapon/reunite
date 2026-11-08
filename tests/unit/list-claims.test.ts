import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@campus/shared';
import { ClaimService } from '@/modules/claims/application/claim-service';
import type { Claim, ClaimRepository } from '@/modules/claims/domain/claim';
import { listClaims } from '@/modules/claims/presentation/list-claims';

process.env.LOG_LEVEL = 'silent';

const user = { userId: 12, name: 'Claimant', email: 'claimant@example.test' };
const claim: Claim = {
  claimId: 42,
  reportId: 7,
  userId: user.userId,
  evidence: 'Receipt with a matching serial number',
  status: 'PENDING',
  claimDate: '2026-11-04T07:15:00.000Z',
  updatedAt: '2026-11-04T07:15:00.000Z',
};

function setup() {
  const listOwned = vi.fn<ClaimRepository['listOwned']>().mockResolvedValue([]);
  const service = new ClaimService({
    listOwned,
    findOwned: vi.fn(),
    create: vi.fn(),
  });
  const requireUser = vi.fn().mockResolvedValue(user);
  const getService = vi.fn(() => service);
  const get = (query = '') =>
    listClaims(
      new Request(`http://localhost/api/v1/claims${query}`),
      requireUser,
      getService,
    );
  return { get, requireUser, getService, listOwned };
}

describe('GET /api/v1/claims', () => {
  it('returns an empty owned list with default pagination', async () => {
    const { get, listOwned } = setup();
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toBeTruthy();
    expect(await response.json()).toEqual({
      data: [],
      meta: { limit: 20, offset: 0 },
    });
    expect(listOwned).toHaveBeenCalledExactlyOnceWith(user.userId, {
      limit: 20,
      offset: 0,
    });
  });

  it('uses the session owner and returns the requested page', async () => {
    const { get, listOwned } = setup();
    listOwned.mockResolvedValueOnce([claim]);
    const response = await get('?limit=1&offset=2');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [claim],
      meta: { limit: 1, offset: 2 },
    });
    expect(listOwned).toHaveBeenCalledExactlyOnceWith(user.userId, {
      limit: 1,
      offset: 2,
    });
  });

  it.each([
    '?limit=0',
    '?limit=101',
    '?offset=-1',
    '?offset=100001',
    '?userId=99',
    '?limit=1&limit=2',
  ])('rejects invalid query %s before looking up claims', async (query) => {
    const { get, getService } = setup();
    const response = await get(query);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        requestId: response.headers.get('X-Request-Id'),
      },
    });
    expect(getService).not.toHaveBeenCalled();
  });

  it('requires a session before validating pagination or looking up claims', async () => {
    const { get, requireUser, getService } = setup();
    requireUser.mockRejectedValueOnce(
      new AppError('UNAUTHORIZED', 401, 'Authentication required'),
    );
    const response = await get('?limit=0');

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    });
    expect(getService).not.toHaveBeenCalled();
  });
});
