import { z } from 'zod';
import { reportPublisherSchema } from '@/modules/item-reports/presentation/reports-client';
import { evidenceAttributes } from '../domain/matching';

const item = z.object({
  reportId: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  location: z.string(),
  occurredAt: z.iso.datetime(),
  hasPhoto: z.boolean(),
  photoCount: z.number().int().min(0).max(3).optional().default(0),
  photoUrls: z.array(z.string()).optional().default([]),
  publisher: reportPublisherSchema,
});

const textComparison = z.object({
  level: z.enum(['high', 'medium', 'low']),
  label: z.string(),
  summary: z.string(),
  matchedKeywords: z.array(z.string()),
  reasons: z.array(
    z.object({
      attribute: z.enum(['text', 'code', 'category', 'location', 'time']),
      relation: z.enum(['agree', 'conflict', 'neutral']),
      detail: z.string(),
    }),
  ),
});

const imageSimilarity = z.object({
  status: z.enum(['both', 'one', 'none']),
  level: z.enum(['similar', 'moderate', 'different', 'unavailable']),
  label: z.string(),
  detail: z.string(),
});

const assessment = z.object({
  decision: z.enum([
    'possible_match',
    'different_item',
    'insufficient_evidence',
  ]),
  summary: z.string(),
  evidence: z.array(
    z.object({
      attribute: z.enum(evidenceAttributes),
      relation: z.enum(['agree', 'conflict']),
      detail: z.string(),
    }),
  ),
  missingEvidence: z.array(z.string()),
  imageComparison: z.enum(['both', 'one', 'none']),
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
  textComparison,
  imageSimilarity,
  assessment: assessment.nullable(),
});
