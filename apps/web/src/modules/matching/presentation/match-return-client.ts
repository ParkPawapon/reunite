import { z } from 'zod';

const item = z.object({
  reportId: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string(),
  occurredAt: z.iso.datetime(),
  hasPhoto: z.boolean(),
});

export const matchReturnSchema = z.object({
  matchId: z.number().int().positive(),
  role: z.enum(['LOST', 'FOUND']),
  lost: item,
  found: item,
  lostRevision: z.string(),
  foundRevision: z.string(),
  lostConfirmedAt: z.iso.datetime().nullable(),
  foundConfirmedAt: z.iso.datetime().nullable(),
  returnedAt: z.iso.datetime().nullable(),
});
