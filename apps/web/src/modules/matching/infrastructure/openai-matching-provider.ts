import 'server-only';
import { z } from 'zod';
import { MATCHING_MODEL } from '@/config/matching';
import { MatchingFailure } from '../application/matching-worker';
import type { MatchJob, MatchingProvider } from '../domain/matching';
import {
  assessmentSchema,
  matchingInstructions as instructions,
  readProviderResponse,
  textItem,
} from './matching-provider-contract';
export { assessmentSchema } from './matching-provider-contract';

const responseSchema = z.object({
  id: z.string().min(1).max(160),
  status: z.literal('completed'),
  model: z.literal(MATCHING_MODEL),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
    }),
  ),
  usage: z.object({
    input_tokens: z.number().int().min(0).max(120000),
    output_tokens: z.number().int().min(0).max(2048),
  }),
});
export class OpenAiMatchingProvider implements MatchingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly transport: typeof fetch = fetch,
  ) {}
  async compare(job: MatchJob) {
    const content: (
      | { type: 'input_text'; text: string }
      | { type: 'input_image'; image_url: string; detail: 'high' }
    )[] = [
      {
        type: 'input_text',
        text: JSON.stringify({
          lost: textItem(job.lost),
          found: textItem(job.found),
        }),
      },
    ];
    for (const [label, entry] of [
      ['LOST', job.lost],
      ['FOUND', job.found],
    ] as const) {
      if (entry.image) {
        content.push({ type: 'input_text', text: `${label} item photo:` });
        content.push({
          type: 'input_image',
          image_url: `data:image/webp;base64,${Buffer.from(entry.image).toString('base64')}`,
          detail: 'high',
        });
      }
    }
    const format = {
      type: 'json_schema',
      name: 'item_match_assessment',
      strict: true,
      schema: z.toJSONSchema(assessmentSchema),
    };
    // UTF-8 bytes upper-bound text tokens; <=2 normalized 1024px images add <2500 tokens.
    // 120K input + 2048 output at the documented snapshot rates reserve < USD 0.10.
    if (
      Buffer.byteLength(
        JSON.stringify({
          instructions,
          format,
          lost: textItem(job.lost),
          found: textItem(job.found),
        }),
      ) > 100000
    )
      throw new MatchingFailure('INPUT_TOO_LARGE', false);
    let response: Response;
    try {
      response = await this.transport('https://api.openai.com/v1/responses', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MATCHING_MODEL,
          store: false,
          instructions,
          input: [{ role: 'user', content }],
          reasoning: { effort: 'none' },
          max_output_tokens: 2048,
          text: { format },
        }),
      });
    } catch {
      throw new MatchingFailure('PROVIDER_UNAVAILABLE', true);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new MatchingFailure(
        response.status === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_REJECTED',
        response.status === 429 || response.status >= 500,
      );
    }
    const data = await readProviderResponse(response);
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success)
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false);
    const parts = parsed.data.output.flatMap((o) => o.content ?? []);
    if (parts.some((p) => p.type === 'refusal'))
      throw new MatchingFailure('PROVIDER_REFUSAL', false);
    const texts = parts.filter((p) => p.type === 'output_text');
    if (texts.length !== 1 || !texts[0]?.text)
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false);
    try {
      const assessment = assessmentSchema.parse(JSON.parse(texts[0].text));
      return {
        assessment,
        model: parsed.data.model,
        responseId: parsed.data.id,
        estimatedUsdMicros: Math.ceil(
          parsed.data.usage.input_tokens * 0.75 +
            parsed.data.usage.output_tokens * 4.5,
        ),
      };
    } catch {
      throw new MatchingFailure('INVALID_ASSESSMENT', false);
    }
  }
}
