import { z } from 'zod';
export const claimCreateSchema = z.strictObject({
  reportId: z.number().int().positive().max(2147483647),
  evidence: z.string().trim().min(1).max(10000),
});
