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
          parts: z.array(z.object({ text: z.string().optional() })).min(1),
        }),
      }),
    )
    .min(1),
});

type GeminiPart =
  { text: string } | { inlineData: { mimeType: string; data: string } };

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
    const { itemText, photos } = await prepareInlineMatchMedia(job);
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
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseJsonSchema: assessmentJsonSchema(false),
          },
        }),
      });
    } catch {
      throw new MatchingFailure('PROVIDER_UNAVAILABLE', true);
    }

    await ensureProviderResponseOk(response);
    const parsed = responseSchema.safeParse(
      await readProviderResponse(response),
    );
    if (!parsed.success)
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false);

    const modelVersion = parsed.data.modelVersion ?? this.model;
    if (
      this.model !== GEMINI_MATCHING_MODEL &&
      !modelVersion.toLowerCase().startsWith(this.model.toLowerCase())
    ) {
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false);
    }

    const rawText = parsed.data.candidates[0]?.content.parts
      .map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!rawText) throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false);

    try {
      const assessment = assessmentSchema.parse(JSON.parse(rawText));
      return {
        assessment,
        model: modelVersion,
        responseId:
          parsed.data.responseId ?? `gemini-${job.matchId}-${Date.now()}`,
        estimatedUsdMicros: 0,
      };
    } catch {
      throw new MatchingFailure('INVALID_ASSESSMENT', false);
    }
  }
}
