import { z } from 'zod';
export const claimCreateSchema = z.strictObject({
  reportId: z.number().int().positive().max(2147483647),
  evidence: z.string().trim().min(1).max(10000),
});

export const claimStatusPatchSchema = z.strictObject({
  status: z.enum(['APPROVED', 'REJECTED']),
  resolutionNote: z.string().trim().min(1).max(1000).nullable().optional(),
});

export const claimHandoverSchema = z.strictObject({
  confirmed: z.literal(true),
});
