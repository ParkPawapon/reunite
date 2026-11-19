import { describe, it, expect, vi, afterEach } from 'vitest';
import sharp from 'sharp';
import {
  reviewAssessment,
  type MatchAssessment,
  type MatchJob,
  type MatchingQueue,
} from '@/modules/matching/domain/matching';
import {
  MatchingWorker,
  MatchingFailure,
} from '@/modules/matching/application/matching-worker';
import { OpenAiMatchingProvider } from '@/modules/matching/infrastructure/openai-matching-provider';
import { matchingConfig, MATCHING_MODEL } from '@/config/matching';
import { normalizeReportImage } from '@/modules/item-reports/infrastructure/report-image';
import { binaryBody } from '@/lib/http/binary-body';

const assessment: MatchAssessment = {
  decision: 'possible_match',
  summary: 'มีรุ่นและรอยตำหนิตรงกัน ควรตรวจสอบกับผู้แจ้ง',
  evidence: [
    {
      attribute: 'model',
      relation: 'agree',
      detail: 'ทั้งสองรายงานระบุรุ่นเดียวกัน',
    },
    {
      attribute: 'damage',
      relation: 'agree',
      detail: 'ทั้งสองรายงานระบุรอยบิ่นมุมขวา',
    },
  ],
  missingEvidence: ['ตรวจสอบหลักฐานกับผู้แจ้ง'],
  imageComparison: 'none',
};
const entry = {
  title: 'ขวดน้ำ',
  description: 'ยี่ห้อเดียวกัน',
  category: 'สิ่งของ',
  location: 'มหาวิทยาลัย',
  eventDatetime: '2026-11-16T08:00:00.000Z',
  image: null,
};
const job: MatchJob = {
  matchId: 1,
  leaseToken: 'lease-test',
  lost: entry,
  found: entry,
};
const output = (overrides: Record<string, unknown> = {}) => ({
  id: 'resp_test',
  model: MATCHING_MODEL,
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(assessment) }],
    },
  ],
  usage: { input_tokens: 500, output_tokens: 200 },
  ...overrides,
});
afterEach(() => vi.unstubAllEnvs());

describe('matching evidence gate', () => {
  it('abstains for generic similarity, missing distinctive attributes, and any conflicting evidence', () => {
    expect(reviewAssessment(assessment).decision).toBe('possible_match');
    for (const evidence of [
      [],
      [
        {
          attribute: 'color' as const,
          relation: 'agree' as const,
          detail: 'สีเดียวกัน',
        },
      ],
      [
        ...assessment.evidence,
        {
          attribute: 'brand' as const,
          relation: 'conflict' as const,
          detail: 'ต่างยี่ห้อ',
        },
      ],
    ])
      expect(reviewAssessment({ ...assessment, evidence }).decision).toBe(
        'insufficient_evidence',
      );
    expect(
      reviewAssessment({ ...assessment, decision: 'different_item' }).decision,
    ).toBe('different_item');
  });
  it('defaults off and requires a key plus an explicit budget when enabled', () => {
    vi.stubEnv('MATCHING_ENABLED', 'false');
    vi.stubEnv('MATCHING_BUDGET_USD', '0');
    expect(matchingConfig().enabled).toBe(false);
    vi.stubEnv('MATCHING_ENABLED', 'true');
    vi.stubEnv('OPENAI_API_KEY', undefined);
    expect(() => matchingConfig()).toThrow('requires');
    vi.stubEnv('OPENAI_API_KEY', 'test-only-key');
    vi.stubEnv('MATCHING_BUDGET_USD', '0.10');
    expect(matchingConfig().budgetUsdMicros).toBe(100000);
    vi.stubEnv('MATCHING_ENABLED', 'yes');
    expect(() => matchingConfig()).toThrow('Invalid');
  });
});

describe('OpenAI adapter contract (stub transport, no paid requests)', () => {
  it('sends bounded item data and inline photos to the fixed HTTPS endpoint with storage disabled', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(output()));
    const provider = new OpenAiMatchingProvider('test-only-key', transport);
    expect((await provider.compare(job)).estimatedUsdMicros).toBe(1275);
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: MATCHING_MODEL,
      store: false,
      max_output_tokens: 2048,
      reasoning: { effort: 'none' },
    });
    expect(body.tools).toBeUndefined();
    expect(String(init?.body)).not.toMatch(
      /email|password_hash|phone|evidence_text|userId/,
    );
    await provider.compare({
      ...job,
      lost: { ...entry, image: new Uint8Array([1, 2, 3]) },
    });
    expect(String(transport.mock.calls[1]?.[1]?.body)).toContain(
      'data:image/webp;base64,AQID',
    );
    expect(String(transport.mock.calls[1]?.[1]?.body)).not.toContain('http://');
  });
  it.each([
    { status: 'incomplete' },
    { model: 'unreviewed-model' },
    { output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
    {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'not-json' }],
        },
      ],
    },
    {
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ ...assessment, decision: '85%' }),
            },
          ],
        },
      ],
    },
    { usage: { input_tokens: 999999, output_tokens: 200 } },
  ])(
    'rejects incomplete, refused, malformed or unreviewed output: %j',
    async (overrides) => {
      const provider = new OpenAiMatchingProvider('test', async () =>
        Response.json(output(overrides)),
      );
      await expect(provider.compare(job)).rejects.toBeInstanceOf(
        MatchingFailure,
      );
    },
  );
  it('retries rate limits and server failures, but not authentication failures', async () => {
    for (const [status, retryable] of [
      [429, true],
      [503, true],
      [401, false],
    ] as const) {
      const provider = new OpenAiMatchingProvider(
        'test',
        async () => new Response('secret upstream body', { status }),
      );
      await expect(provider.compare(job)).rejects.toMatchObject({ retryable });
    }
  });
  it('does not follow redirects or accept an oversized response', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('x'.repeat(65537)));
    await expect(
      new OpenAiMatchingProvider('test', transport).compare(job),
    ).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
    expect(transport.mock.calls[0]?.[1]?.redirect).toBe('error');
  });
});

it('keeps no-budget jobs pending and rejects fabricated two-photo comparisons', async () => {
  const queue: MatchingQueue = {
    reconcile: vi.fn(),
    claim: vi.fn(async () => null),
    complete: vi.fn(),
    fail: vi.fn(),
  };
  const compare = vi.fn(async () => ({
    assessment,
    model: MATCHING_MODEL,
    responseId: 'test',
    estimatedUsdMicros: 1,
  }));
  expect(
    await new MatchingWorker(queue, { compare }, 0, 100000).runOnce(),
  ).toBe(false);
  expect(compare).not.toHaveBeenCalled();
  queue.claim = async () => job;
  compare.mockResolvedValue({
    ...(await compare()),
    assessment: { ...assessment, imageComparison: 'both' },
  });
  await new MatchingWorker(queue, { compare }, 100000, 100000).runOnce();
  expect(queue.complete).not.toHaveBeenCalled();
  expect(queue.fail).toHaveBeenCalledWith(
    job,
    'INVALID_IMAGE_ASSESSMENT',
    false,
  );
});

it('normalizes item photos without cropping or metadata and rejects spoofed or oversized uploads', async () => {
  const source = await sharp({
    create: { width: 1400, height: 700, channels: 3, background: '#ff8800' },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const meta = await sharp(
    await normalizeReportImage(source, 'image/jpeg'),
  ).metadata();
  expect(meta).toMatchObject({ format: 'webp', width: 1024, height: 512 });
  expect(meta.exif).toBeUndefined();
  await expect(normalizeReportImage(source, 'image/png')).rejects.toMatchObject(
    { status: 422 },
  );
  await expect(
    normalizeReportImage(source, 'image/svg+xml'),
  ).rejects.toMatchObject({ status: 415 });
  await expect(
    normalizeReportImage(new Uint8Array(4 * 1024 * 1024 + 1), 'image/png'),
  ).rejects.toMatchObject({ status: 413 });
});
it('enforces the byte limit on a streamed upload without a content-length header', async () => {
  const request = new Request('http://localhost/upload', {
    method: 'PUT',
    body: new Uint8Array(20),
  });
  await expect(binaryBody(request, 10)).rejects.toMatchObject({ status: 413 });
});
