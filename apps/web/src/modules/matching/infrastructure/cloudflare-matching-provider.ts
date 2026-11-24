import 'server-only';
import { z } from 'zod';
import { CLOUDFLARE_MATCHING_MODEL } from '@/config/matching';
import { MatchingFailure } from '../application/matching-worker';
import type { MatchJob, MatchingProvider } from '../domain/matching';
import { prepareMatchImageForAi } from './image-comparison';
import {
  assessmentSchema,
  matchingInstructions,
  readProviderResponse,
  textItem,
} from './matching-provider-contract';

const maxPhotoBytes = 1024 * 1024;
const maxOutputTokens = 2048;
const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'item_match_assessment',
    strict: true,
    schema: z.toJSONSchema(assessmentSchema),
  },
};
const responseSchema = z.object({
  id: z.string().min(1).max(160),
  model: z.literal(CLOUDFLARE_MATCHING_MODEL),
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

type Content =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export class CloudflareMatchingProvider implements MatchingProvider {
  private readonly endpoint: string;

  constructor(
    accountId: string,
    private readonly token: string,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (!/^[a-f0-9]{32}$/i.test(accountId))
      throw new Error('Invalid Cloudflare account ID');
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  }

  async compare(job: MatchJob) {
    const itemText = JSON.stringify({
      lost: textItem(job.lost),
      found: textItem(job.found),
    });
    if (Buffer.byteLength(itemText) > 65_000)
      throw new MatchingFailure('INPUT_TOO_LARGE', false);
    const content: Content[] = [{ type: 'text', text: itemText }];
    for (const [label, item] of [
      ['LOST', job.lost],
      ['FOUND', job.found],
    ] as const) {
      if (!item.image) continue;
      const prepared = await prepareMatchImageForAi(item.image);
      if (prepared.byteLength > maxPhotoBytes)
        throw new MatchingFailure('INPUT_TOO_LARGE', false);
      content.push({ type: 'text', text: `${label} item photo:` });
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/webp;base64,${Buffer.from(prepared).toString('base64')}`,
        },
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
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: CLOUDFLARE_MATCHING_MODEL,
          messages: [
            { role: 'system', content: matchingInstructions },
            { role: 'user', content },
          ],
          chat_template_kwargs: { enable_thinking: false },
          max_completion_tokens: maxOutputTokens,
          response_format: responseFormat,
          store: false,
          temperature: 0,
        }),
      });
    } catch {
      throw new MatchingFailure('PROVIDER_UNAVAILABLE', true);
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const seconds =
          retryAfter && /^\d+$/.test(retryAfter)
            ? Number(retryAfter)
            : retryAfter
              ? Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000)
              : NaN;
        const delay = Number.isFinite(seconds)
          ? Math.min(86_400, Math.max(60, seconds))
          : 900;
        throw new MatchingFailure('PROVIDER_RATE_LIMITED', true, delay);
      }
      throw new MatchingFailure('PROVIDER_REJECTED', response.status >= 500);
    }
    const parsed = responseSchema.safeParse(
      await readProviderResponse(response),
    );
    if (!parsed.success)
      throw new MatchingFailure('INVALID_PROVIDER_RESPONSE', false);
    try {
      const assessment = assessmentSchema.parse(
        JSON.parse(parsed.data.choices[0].message.content),
      );
      return {
        assessment,
        model: parsed.data.model,
        responseId: parsed.data.id,
        estimatedUsdMicros: 0,
      };
    } catch {
      throw new MatchingFailure('INVALID_ASSESSMENT', false);
    }
  }
}
