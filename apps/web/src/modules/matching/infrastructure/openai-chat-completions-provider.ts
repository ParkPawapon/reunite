import 'server-only';
import { z } from 'zod';
import { MatchingFailure } from '../application/matching-worker';
import type { MatchJob, ProviderResult } from '../domain/matching';
import {
  assessmentJsonSchema,
  assessmentSchema,
  ensureProviderResponseOk,
  matchingInstructions,
  parseJsonPayload,
  prepareInlineMatchMedia,
  readProviderResponse,
} from './matching-provider-contract';

export type ChatCompletionsOptions = {
  endpoint: string;
  apiKey: string;
  model: string;
  maxImages?: number;
  strictSchema: boolean;
  includeStoreFalse?: boolean;
  extraBody?: Record<string, unknown>;
  timeoutMs?: number;
  transport?: typeof fetch;
};

type ChatContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export async function compareWithChatCompletions(
  job: MatchJob,
  options: ChatCompletionsOptions,
): Promise<ProviderResult> {
  const { expectedImageComparison, itemText, photos } =
    await prepareInlineMatchMedia(job, options.maxImages);
  const content: ChatContent[] = [{ type: 'text', text: itemText }];
  for (const photo of photos) {
    content.push({ type: 'text', text: photo.label });
    content.push({
      type: 'image_url',
      image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` },
    });
  }

  const transport = options.transport ?? fetch;
  const responseSchema = z.object({
    id: z.string().min(1).max(160),
    model: z.string().min(1).max(160),
    choices: z.tuple([
      z.object({
        finish_reason: z.literal('stop'),
        message: z.object({
          content: z.string().min(1),
          refusal: z.null().optional(),
        }),
      }),
    ]),
  });

  let response: Response;
  try {
    response = await transport(options.endpoint, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 35_000),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: matchingInstructions },
          { role: 'user', content },
        ],
        max_completion_tokens: 2048,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'item_match_assessment',
            strict: options.strictSchema,
            schema: assessmentJsonSchema(true, options.strictSchema),
          },
        },
        ...(options.includeStoreFalse ? { store: false } : {}),
        temperature: 0,
        ...options.extraBody,
      }),
    });
  } catch {
    throw new MatchingFailure('PROVIDER_UNAVAILABLE', true, undefined, {
      stage: 'network',
    });
  }

  await ensureProviderResponseOk(response);
  const parsed = responseSchema.safeParse(await readProviderResponse(response));
  if (!parsed.success || parsed.data.model !== options.model) {
    throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false, undefined, {
      stage: 'response_shape',
    });
  }

  let assessment: z.infer<typeof assessmentSchema>;
  try {
    assessment = assessmentSchema.parse(
      parseJsonPayload(parsed.data.choices[0].message.content),
    );
  } catch (error) {
    throw new MatchingFailure('INVALID_ASSESSMENT', false, undefined, {
      stage: 'assessment_schema',
      detail:
        error instanceof z.ZodError
          ? error.issues
              .slice(0, 2)
              .map((i) => `${i.path.join('.') || 'root'}:${i.code}`)
              .join(',')
          : 'json_parse',
    });
  }
  if (assessment.imageComparison !== expectedImageComparison) {
    throw new MatchingFailure('INVALID_IMAGE_ASSESSMENT', false, undefined, {
      stage: 'image_flag',
      detail: `${assessment.imageComparison}!=${expectedImageComparison}`,
    });
  }
  return {
    assessment,
    model: parsed.data.model,
    responseId: parsed.data.id,
    estimatedUsdMicros: 0,
  };
}
