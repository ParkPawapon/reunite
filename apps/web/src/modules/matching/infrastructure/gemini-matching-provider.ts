import 'server-only';
import { z } from 'zod';
import { GEMINI_MATCHING_MODEL } from '@/config/matching';
import { MatchingFailure } from '../application/matching-worker';
import type { MatchJob, MatchingProvider } from '../domain/matching';
import {
  assessmentJsonSchema,
  assessmentSchema,
  ensureProviderResponseOk,
  matchingInstructions,
  parseJsonPayload,
  prepareInlineMatchMedia,
  readProviderResponse,
} from './matching-provider-contract';

const responseSchema = z.object({
  responseId: z.string().min(1).max(160).optional(),
  modelVersion: z
    .string()
    .regex(/^gemini-[a-z0-9._-]+$/i)
    .optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.literal('STOP'),
        content: z.object({
          parts: z
            .array(
              z.object({
                text: z.string().optional(),
                thought: z.boolean().optional(),
              }),
            )
            .min(1),
        }),
      }),
    )
    .min(1),
});

type GeminiPart =
  { text: string } | { inlineData: { mimeType: string; data: string } };

function buildGeminiGenerationConfig(model: string) {
  const isLegacyV2 = model.toLowerCase().startsWith('gemini-2.');
  const supportsThinkingLevel = /^gemini-(?:3|4)/i.test(model);
  return {
    ...(isLegacyV2 ? { temperature: 0 } : {}),
    ...(supportsThinkingLevel
      ? {
          thinkingConfig: {
            thinkingLevel: model.toLowerCase().includes('flash-lite')
              ? 'minimal'
              : 'low',
          },
        }
      : {}),
    maxOutputTokens: isLegacyV2 ? 4096 : 8192,
    responseMimeType: 'application/json',
    responseJsonSchema: assessmentJsonSchema(false, false),
  };
}

export class GeminiMatchingProvider implements MatchingProvider {
  private readonly endpoint: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = GEMINI_MATCHING_MODEL,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (!/^gemini-[a-z0-9._-]+$/i.test(model))
      throw new Error('Invalid Gemini model');
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  async compare(job: MatchJob) {
    const { expectedImageComparison, itemText, photos } =
      await prepareInlineMatchMedia(job);
    const parts: GeminiPart[] = [{ text: itemText }];
    for (const photo of photos) {
      parts.push({ text: photo.label });
      parts.push({
        inlineData: { mimeType: photo.mimeType, data: photo.base64 },
      });
    }

    let response: Response;
    try {
      response = await this.transport(this.endpoint, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(35_000),
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: matchingInstructions }] },
          contents: [{ role: 'user', parts }],
          generationConfig: buildGeminiGenerationConfig(this.model),
        }),
      });
    } catch {
      throw new MatchingFailure('PROVIDER_UNAVAILABLE', true, undefined, {
        stage: 'network',
      });
    }

    await ensureProviderResponseOk(response);
    const body = await readProviderResponse(response);
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) {
      const candidateFinish =
        body &&
        typeof body === 'object' &&
        Array.isArray((body as { candidates?: unknown[] }).candidates)
          ? (body as { candidates: { finishReason?: unknown }[] }).candidates[0]
              ?.finishReason
          : undefined;
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false, undefined, {
        stage: 'response_shape',
        detail:
          typeof candidateFinish === 'string'
            ? `finishReason:${candidateFinish}`
            : parsed.error.issues[0]?.path.join('.') || 'invalid_envelope',
      });
    }

    const modelVersion = parsed.data.modelVersion ?? this.model;
    if (
      this.model !== GEMINI_MATCHING_MODEL &&
      this.model !== 'gemini-flash-latest' &&
      !modelVersion.toLowerCase().startsWith(this.model.toLowerCase())
    ) {
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false, undefined, {
        stage: 'model_mismatch',
      });
    }

    const rawText = parsed.data.candidates[0]?.content.parts
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!rawText) {
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false, undefined, {
        stage: 'empty_output',
      });
    }

    let assessment: z.infer<typeof assessmentSchema>;
    try {
      assessment = assessmentSchema.parse(parseJsonPayload(rawText));
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
      model: modelVersion,
      responseId:
        parsed.data.responseId ?? `gemini-${job.matchId}-${Date.now()}`,
      estimatedUsdMicros: 0,
    };
  }
}
