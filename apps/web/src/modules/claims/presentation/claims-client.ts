import { z } from 'zod';

const claimSchema = z.object({
  claimId: z.number().int().positive(),
  evidence: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  resolutionNote: z.string().optional(),
  finderConfirmedAt: z.iso.datetime().optional(),
  claimantConfirmedAt: z.iso.datetime().optional(),
  claimDate: z.iso.datetime(),
});

export type ClaimRecord = z.infer<typeof claimSchema>;
export const CLAIM_PAGE_SIZE = 10;

export class ClaimRequestError extends Error {
  constructor(public readonly status: number) {
    super('Claim request failed');
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  mutation?: { method: 'PATCH' | 'POST'; body: object },
) {
  const response = await fetch(`/api/v1/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    ...(mutation && {
      method: mutation.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutation.body),
    }),
  });
  if (!response.ok) throw new ClaimRequestError(response.status);
  const parsed = z.object({ data: schema }).safeParse(await response.json());
  if (!parsed.success) throw new ClaimRequestError(503);
  return parsed.data.data;
}

export async function loadReportClaims(
  reportId: number,
  owner: boolean,
  page: number,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({
    limit: String(CLAIM_PAGE_SIZE + 1),
    offset: String(page * CLAIM_PAGE_SIZE),
  });
  const path = owner ? `item-reports/${reportId}/claims` : 'claims';
  if (!owner) params.set('reportId', String(reportId));
  const claims = await request(
    `${path}?${params}`,
    z.array(claimSchema),
    signal,
  );
  return {
    claims: claims.slice(0, CLAIM_PAGE_SIZE),
    hasNext: claims.length > CLAIM_PAGE_SIZE,
  };
}

export function submitClaim(
  reportId: number,
  evidence: string,
  signal: AbortSignal,
) {
  return request('claims', claimSchema, signal, {
    method: 'POST',
    body: { reportId, evidence },
  });
}

export function reviewClaim(
  claimId: number,
  status: 'APPROVED' | 'REJECTED',
  resolutionNote: string,
  signal: AbortSignal,
) {
  return request(`claims/${claimId}/status`, claimSchema, signal, {
    method: 'PATCH',
    body: { status, resolutionNote: resolutionNote || null },
  });
}

export function confirmClaimHandover(claimId: number, signal: AbortSignal) {
  return request(`claims/${claimId}/handover`, claimSchema, signal, {
    method: 'PATCH',
    body: { confirmed: true },
  });
}
