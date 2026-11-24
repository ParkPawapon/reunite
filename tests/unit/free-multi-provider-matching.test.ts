import { afterEach, expect, it, vi } from 'vitest';
import {
  CLOUDFLARE_MATCHING_MODEL,
  GEMINI_MATCHING_MODEL,
  GROQ_MATCHING_MODEL,
  matchingConfig,
} from '@/config/matching';
import { POST } from '@/app/api/internal/matching/run/route';
import { MatchingFailure } from '@/modules/matching/application/matching-worker';
import type {
  MatchJob,
  MatchingProvider,
} from '@/modules/matching/domain/matching';
import { FallbackMatchingProvider } from '@/modules/matching/infrastructure/fallback-matching-provider';
import { GeminiMatchingProvider } from '@/modules/matching/infrastructure/gemini-matching-provider';
import { GroqMatchingProvider } from '@/modules/matching/infrastructure/groq-matching-provider';
import { createMatchingWorker } from '@/modules/matching/infrastructure/create-matching-worker';

const cfAccount = 'a'.repeat(32);
const item = {
  title: 'ขวดน้ำสีน้ำเงิน',
  description: 'มีสติกเกอร์แมวสีส้ม',
  category: 'ของใช้ส่วนตัว',
  location: 'อาคาร LX',
  eventDatetime: '2026-11-24T12:00:00Z',
  image: Uint8Array.of(1, 2, 3),
};
const job: MatchJob = {
  matchId: 7,
  leaseToken: 'lease-7',
  lost: item,
  found: item,
};
const assessment = {
  decision: 'possible_match' as const,
  summary: 'ตรงกันทั้งสีและสติกเกอร์แมว',
  evidence: [
    {
      attribute: 'marking' as const,
      relation: 'agree' as const,
      detail: 'มีสติกเกอร์แมวสีส้ม',
    },
    {
      attribute: 'color' as const,
      relation: 'agree' as const,
      detail: 'ขวดสีน้ำเงินเหมือนกัน',
    },
  ],
  missingEvidence: ['รอยบุบด้านล่าง'],
  imageComparison: 'both' as const,
};

afterEach(() => vi.unstubAllEnvs());

it('calls Gemini generateContent with header key auth, schema without $schema, and inline WebP photos', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      responseId: 'gemini-resp-1',
      modelVersion: 'gemini-3.8-flash-001',
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [
              { thought: true, text: 'ignoring internal thought' },
              { text: `\`\`\`json\n${JSON.stringify(assessment)}\n\`\`\`` },
            ],
          },
        },
      ],
    }),
  );
  const provider = new GeminiMatchingProvider(
    'gemini-secret-key',
    GEMINI_MATCHING_MODEL,
    transport,
  );
  await expect(provider.compare(job)).resolves.toMatchObject({
    assessment,
    model: 'gemini-3.8-flash-001',
    responseId: 'gemini-resp-1',
    estimatedUsdMicros: 0,
  });

  const [url, init] = transport.mock.calls[0] ?? [];
  expect(url).toBe(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MATCHING_MODEL}:generateContent`,
  );
  expect(String(url)).not.toContain('gemini-secret-key');
  expect(init?.headers).toMatchObject({
    'x-goog-api-key': 'gemini-secret-key',
  });
  const body = JSON.parse(String(init?.body));
  expect(body.generationConfig.temperature).toBeUndefined();
  expect(body.generationConfig.maxOutputTokens).toBe(8192);
  expect(body.generationConfig.thinkingConfig).toEqual({
    thinkingLevel: 'low',
  });
  expect(body.generationConfig.responseJsonSchema.$schema).toBeUndefined();
  expect(
    body.generationConfig.responseJsonSchema.properties.summary.maxLength,
  ).toBeUndefined();
  const keys = Object.keys(body.generationConfig.responseJsonSchema.properties);
  expect(keys.indexOf('evidence')).toBeLessThan(keys.indexOf('decision'));
  expect(JSON.parse(body.contents[0].parts[0].text)).toMatchObject({
    expectedImageComparison: 'both',
  });
  expect(body.contents[0].parts).toEqual(
    expect.arrayContaining([
      { text: 'LOST item photo:' },
      { inlineData: { mimeType: 'image/webp', data: 'AQID' } },
      { text: 'FOUND item photo:' },
    ]),
  );
});

it('caps Groq vision inputs cleanly to 3 balanced photos, isolates parsed reasoning, and rejects empty evidence', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        id: 'groq-resp-1',
        model: GROQ_MATCHING_MODEL,
        choices: [
          {
            finish_reason: 'stop',
            message: { content: JSON.stringify(assessment), refusal: null },
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        id: 'groq-empty-evidence',
        model: GROQ_MATCHING_MODEL,
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({ ...assessment, evidence: [] }),
              refusal: null,
            },
          },
        ],
      }),
    );
  const provider = new GroqMatchingProvider(
    'groq-secret',
    GROQ_MATCHING_MODEL,
    transport,
  );
  const multiPhotoJob: MatchJob = {
    ...job,
    lost: {
      ...item,
      images: [Uint8Array.of(1), Uint8Array.of(2), Uint8Array.of(3)],
    },
    found: {
      ...item,
      images: [Uint8Array.of(4), Uint8Array.of(5), Uint8Array.of(6)],
    },
  };
  await expect(provider.compare(multiPhotoJob)).resolves.toMatchObject({
    assessment,
    model: GROQ_MATCHING_MODEL,
    estimatedUsdMicros: 0,
  });

  const body = JSON.parse(String(transport.mock.calls[0]?.[1]?.body));
  expect(body.store).toBeUndefined();
  expect(body.reasoning_effort).toBe('low');
  expect(body.reasoning_format).toBe('parsed');
  const imageParts = body.messages[1].content.filter(
    (part: { type: string }) => part.type === 'image_url',
  );
  const labels = body.messages[1].content
    .filter(
      (part: { type: string; text?: string }) =>
        part.type === 'text' && part.text?.includes('item photo'),
    )
    .map((part: { text: string }) => part.text);
  expect(imageParts).toHaveLength(3);
  expect(labels).toEqual([
    'LOST item photo 1:',
    'LOST item photo 2:',
    'FOUND item photo 1:',
  ]);

  await expect(provider.compare(job)).rejects.toMatchObject({
    code: 'INVALID_ASSESSMENT',
    retryable: false,
  });
});

it('falls back across free providers on 429/503 and cools down throttled or rejected primaries cleanly', async () => {
  vi.stubEnv('LOG_LEVEL', 'silent');
  let clock = 1_000_000;
  const gemini: MatchingProvider = {
    compare: vi
      .fn()
      .mockRejectedValue(
        new MatchingFailure('PROVIDER_RATE_LIMITED', true, 120),
      ),
  };
  const groq: MatchingProvider = {
    compare: vi
      .fn()
      .mockRejectedValueOnce(new MatchingFailure('PROVIDER_UNAVAILABLE', true))
      .mockResolvedValue({
        assessment,
        model: GROQ_MATCHING_MODEL,
        responseId: 'groq-ok',
        estimatedUsdMicros: 0,
      }),
  };
  const cloudflare: MatchingProvider = {
    compare: vi.fn().mockResolvedValue({
      assessment,
      model: CLOUDFLARE_MATCHING_MODEL,
      responseId: 'cf-ok',
      estimatedUsdMicros: 0,
    }),
  };

  const fallback = new FallbackMatchingProvider(
    [
      { name: 'gemini', provider: gemini },
      { name: 'groq', provider: groq },
      { name: 'cloudflare', provider: cloudflare },
    ],
    () => clock,
  );

  // First call: Gemini 429 -> Groq 503 -> Cloudflare succeeds.
  await expect(fallback.compare(job)).resolves.toMatchObject({
    model: CLOUDFLARE_MATCHING_MODEL,
  });
  expect(gemini.compare).toHaveBeenCalledTimes(1);

  // Second call within 120s cooldown: skips Gemini and runs Groq directly.
  clock += 30_000;
  await expect(fallback.compare(job)).resolves.toMatchObject({
    model: GROQ_MATCHING_MODEL,
  });
  expect(gemini.compare).toHaveBeenCalledTimes(1);

  const rejectedPrimary: MatchingProvider = {
    compare: vi.fn().mockRejectedValue(
      new MatchingFailure('PROVIDER_REJECTED', false, undefined, {
        httpStatus: 400,
      }),
    ),
  };
  const backup: MatchingProvider = {
    compare: vi.fn().mockResolvedValue({
      assessment,
      model: GROQ_MATCHING_MODEL,
      responseId: 'groq-backup',
      estimatedUsdMicros: 0,
    }),
  };
  const rejectFallback = new FallbackMatchingProvider(
    [
      { name: 'gemini', provider: rejectedPrimary },
      { name: 'groq', provider: backup },
    ],
    () => clock,
  );
  await expect(rejectFallback.compare(job)).resolves.toMatchObject({
    responseId: 'groq-backup',
  });
  await expect(rejectFallback.compare(job)).resolves.toMatchObject({
    responseId: 'groq-backup',
  });
  expect(rejectedPrimary.compare).toHaveBeenCalledTimes(1);
});

it('builds ordered free fallback chains for auto and unlocks higher free daily limits', () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/test');
  vi.stubEnv('MATCHING_ENABLED', 'true');
  vi.stubEnv('MATCHING_PROVIDER', 'auto');
  vi.stubEnv('MATCHING_BUDGET_USD', '0');
  vi.stubEnv('MATCHING_FREE_DAILY_LIMIT', '400');
  vi.stubEnv('GEMINI_API_KEY', 'gem-key');
  vi.stubEnv('GROQ_API_KEY', 'groq-key');
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', cfAccount);
  vi.stubEnv('CLOUDFLARE_WORKERS_AI_TOKEN', 'cf-key');

  const config = matchingConfig();
  expect(config.provider).toBe('auto');
  expect(config.freeDailyLimit).toBe(400);
  expect(config.freeProviders.map((entry) => entry.provider)).toEqual([
    'gemini',
    'groq',
    'cloudflare',
  ]);
  expect(createMatchingWorker()).not.toBeNull();

  vi.stubEnv('MATCHING_PROVIDER', 'groq');
  expect(matchingConfig().freeProviders.map((entry) => entry.provider)).toEqual(
    ['groq', 'gemini', 'cloudflare'],
  );
});

it('stops immediately on INPUT_TOO_LARGE and aggregates shortest 429 cooldown when all free providers throttle', async () => {
  const largeError = new MatchingFailure('INPUT_TOO_LARGE', false);
  const geminiTooLarge: MatchingProvider = {
    compare: vi.fn().mockRejectedValue(largeError),
  };
  const backup: MatchingProvider = { compare: vi.fn() };
  await expect(
    new FallbackMatchingProvider([
      { name: 'gemini', provider: geminiTooLarge },
      { name: 'cloudflare', provider: backup },
    ]).compare(job),
  ).rejects.toMatchObject({ code: 'INPUT_TOO_LARGE', retryable: false });
  expect(backup.compare).not.toHaveBeenCalled();

  const slowRateLimited: MatchingProvider = {
    compare: vi
      .fn()
      .mockRejectedValue(
        new MatchingFailure('PROVIDER_RATE_LIMITED', true, 600),
      ),
  };
  const fasterRateLimited: MatchingProvider = {
    compare: vi
      .fn()
      .mockRejectedValue(
        new MatchingFailure('PROVIDER_RATE_LIMITED', true, 120),
      ),
  };
  await expect(
    new FallbackMatchingProvider([
      { name: 'gemini', provider: slowRateLimited },
      { name: 'groq', provider: fasterRateLimited },
    ]).compare(job),
  ).rejects.toMatchObject({
    code: 'PROVIDER_RATE_LIMITED',
    retryable: true,
    retryAfterSeconds: 120,
  });
});

it('processes a bounded batch per matching scheduler request', async () => {
  vi.stubEnv('LOG_LEVEL', 'silent');
  vi.stubEnv('MATCHING_ENABLED', 'false');
  const secret = 'c'.repeat(64);
  vi.stubEnv('MATCHING_RUNNER_SECRET', secret);

  const response = await POST(
    new Request('https://reunite.tech/api/internal/matching/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ processed: false });
});
