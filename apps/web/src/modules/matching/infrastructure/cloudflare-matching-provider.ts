import 'server-only';
import { CLOUDFLARE_MATCHING_MODEL } from '@/config/matching';
import type { MatchJob, MatchingProvider } from '../domain/matching';
import { compareWithChatCompletions } from './openai-chat-completions-provider';

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

  compare(job: MatchJob) {
    return compareWithChatCompletions(job, {
      endpoint: this.endpoint,
      apiKey: this.token,
      model: CLOUDFLARE_MATCHING_MODEL,
      strictSchema: true,
      includeStoreFalse: true,
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
      transport: this.transport,
    });
  }
}
