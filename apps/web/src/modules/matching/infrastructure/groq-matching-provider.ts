import 'server-only';
import { GROQ_MATCHING_MODEL } from '@/config/matching';
import type { MatchJob, MatchingProvider } from '../domain/matching';
import { compareWithChatCompletions } from './openai-chat-completions-provider';

// Active Groq multimodal models (e.g. qwen/qwen3.8-27b) accept up to 3 images per request.
const GROQ_MAX_IMAGES = 3;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqMatchingProvider implements MatchingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = GROQ_MATCHING_MODEL,
    private readonly transport: typeof fetch = fetch,
  ) {}

  compare(job: MatchJob) {
    return compareWithChatCompletions(job, {
      endpoint: GROQ_ENDPOINT,
      apiKey: this.apiKey,
      model: this.model,
      maxImages: GROQ_MAX_IMAGES,
      strictSchema: false,
      includeStoreFalse: false,
      ...(this.model.startsWith('qwen/qwen3')
        ? { extraBody: { reasoning_effort: 'none' } }
        : {}),
      transport: this.transport,
    });
  }
}
