import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@campus/shared';
import { ClaimService } from '@/modules/claims/application/claim-service';
import type { Claim, ClaimRepository } from '@/modules/claims/domain/claim';
import { getClaim } from '@/modules/claims/presentation/get-claim';

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
  const findOwned = vi
    .fn<ClaimRepository['findOwned']>()
    .mockResolvedValue(null);
  const service = new ClaimService({
    listOwned: vi.fn(),
    findOwned,
    create: vi.fn(),
  });
  const requireUser = vi.fn().mockResolvedValue(user);
  const getService = vi.fn(() => service);
  const get = (id: string) =>
    getClaim(
      new Request(`http://localhost/api/v1/claims/${id}`),
      { params: Promise.resolve({ id }) },
      requireUser,
      getService,
    );
  return { get, requireUser, getService, findOwned };
}

describe('GET /api/v1/claims/:id', () => {
  it('returns the claim and its evidence to the owner', async () => {
    const { get, findOwned } = setup();
    findOwned.mockResolvedValueOnce(claim);
    const response = await get('42');

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toBeTruthy();
    expect(await response.json()).toEqual({ data: claim });
    expect(findOwned).toHaveBeenCalledExactlyOnceWith(42, user.userId);
  });

  it('returns the same error for a missing claim and a claim owned by someone else', async () => {
    const { get, findOwned } = setup();
    const foreignClaim = { ...claim, userId: 99 };
    findOwned.mockImplementation(async (id, userId) =>
      id === foreignClaim.claimId && userId === foreignClaim.userId
        ? foreignClaim
        : null,
    );

    for (const id of ['42', '43']) {
      const response = await get(id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Claim not found',
          requestId: response.headers.get('X-Request-Id'),
        },
      });
    }
    expect(findOwned.mock.calls).toEqual([
      [42, user.userId],
      [43, user.userId],
    ]);
  });

  it.each(['abc', '0', '-1', '1.5', '2147483648'])(
    'rejects invalid claim ID %s before looking up the claim',
    async (id) => {
      const { get, getService } = setup();
      const response = await get(id);

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          requestId: response.headers.get('X-Request-Id'),
        },
      });
      expect(getService).not.toHaveBeenCalled();
    },
  );

  it('requires a session before validating the ID or looking up the claim', async () => {
    const { get, requireUser, getService } = setup();
    requireUser.mockRejectedValueOnce(
      new AppError('UNAUTHORIZED', 401, 'Authentication required'),
    );
    const response = await get('abc');

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    });
    expect(getService).not.toHaveBeenCalled();
  });
});
