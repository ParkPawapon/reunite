import 'server-only';
import { z } from 'zod';
import { assessmentSchema } from './openai-matching-provider';
export function parseEvaluationInput(input: unknown) {
  const rows = z
    .array(
      z.strictObject({
        id: z.string().min(1),
        sameItem: z.boolean(),
        assessment: assessmentSchema,
      }),
    )
    .min(1)
    .parse(input);
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new Error('Evaluation IDs must be unique');
  return rows;
}
