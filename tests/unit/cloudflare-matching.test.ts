import { afterEach, expect, it, vi } from 'vitest';
import { CLOUDFLARE_MATCHING_MODEL, matchingConfig } from '@/config/matching';
import { CloudflareMatchingProvider } from '@/modules/matching/infrastructure/cloudflare-matching-provider';
import type { MatchJob } from '@/modules/matching/domain/matching';
import { POST } from '@/app/api/internal/matching/run/route';

const account = 'a'.repeat(32);
const item = {
  title: 'กระบอกน้ำสีส้ม',
  description: 'มีรอยบิ่นมุมขวา',
  category: 'ของใช้',
  location: 'อาคาร LX',
  eventDatetime: '2026-11-21T07:00:00Z',
  image: Uint8Array.of(1, 2, 3),
};
const job: MatchJob = {
  matchId: 1,
  leaseToken: 'local-lease',
  lost: item,
  found: item,
};
const assessment = {
  decision: 'insufficient_evidence',
  summary: 'สีส้มตรงกัน ควรตรวจหลักฐานเพิ่มเติม',
  evidence: [],
  missingEvidence: ['รอยตำหนิที่เห็นได้จากทั้งสองด้าน'],
  imageComparison: 'both',
};
const completion = (content: unknown) => ({
  id: 'cloudflare-test',
  model: CLOUDFLARE_MATCHING_MODEL,
  choices: [
    {
      finish_reason: 'stop',
      message: { content: JSON.stringify(content), refusal: null },
    },
  ],
});

afterEach(() => vi.unstubAllEnvs());

it('sends only the report fields and two separately labelled inline photos', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(completion(assessment)));
  const provider = new CloudflareMatchingProvider(
    account,
    'test-only-token',
    transport,
  );
  await expect(provider.compare(job)).resolves.toMatchObject({
    assessment,
    estimatedUsdMicros: 0,
  });
  const [url, init] = transport.mock.calls[0] ?? [];
  expect(url).toBe(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`,
  );
  expect(init?.redirect).toBe('error');
  const body = JSON.parse(String(init?.body));
  expect(body).toMatchObject({
    store: false,
    response_format: { type: 'json_schema' },
  });
  expect(body.messages[1].content.slice(1)).toEqual([
    { type: 'text', text: 'LOST item photo:' },
    { type: 'image_url', image_url: { url: 'data:image/webp;base64,AQID' } },
    { type: 'text', text: 'FOUND item photo:' },
    { type: 'image_url', image_url: { url: 'data:image/webp;base64,AQID' } },
  ]);
  expect(JSON.stringify(body)).not.toContain(job.leaseToken);
});

it('fails closed on invalid output and uses the provider rate-limit delay', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json(completion({ ...assessment, confidence: 100 })),
    )
    .mockResolvedValueOnce(
      new Response(null, { status: 429, headers: { 'retry-after': '180' } }),
    );
  const provider = new CloudflareMatchingProvider(
    account,
    'test-only-token',
    transport,
  );
  await expect(provider.compare(job)).rejects.toMatchObject({
    code: 'INVALID_ASSESSMENT',
    retryable: false,
  });
  await expect(provider.compare(job)).rejects.toMatchObject({
    code: 'PROVIDER_RATE_LIMITED',
    retryable: true,
    retryAfterSeconds: 180,
  });
});

it('requires scoped Cloudflare credentials and enforces a zero USD budget', () => {
  vi.stubEnv('MATCHING_PROVIDER', 'cloudflare');
  vi.stubEnv('MATCHING_ENABLED', 'true');
  vi.stubEnv('MATCHING_BUDGET_USD', '0');
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', account);
  vi.stubEnv('CLOUDFLARE_WORKERS_AI_TOKEN', undefined);
  expect(() => matchingConfig()).toThrow('Workers AI token');
  vi.stubEnv('CLOUDFLARE_WORKERS_AI_TOKEN', 'test-only-token');
  expect(matchingConfig()).toMatchObject({
    provider: 'cloudflare',
    freeDailyLimit: 10,
    budgetUsdMicros: 0,
  });
  vi.stubEnv('MATCHING_BUDGET_USD', '0.10');
  expect(() => matchingConfig()).toThrow('zero USD budget');
});

it('rejects scheduler requests without the private bearer secret', async () => {
  vi.stubEnv('LOG_LEVEL', 'silent');
  vi.stubEnv('MATCHING_ENABLED', 'false');
  const secret = 'a'.repeat(64);
  const request = (token?: string) =>
    new Request('https://reunite-kmutt.vercel.app/api/internal/matching/run', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  vi.stubEnv('MATCHING_RUNNER_SECRET', undefined);
  expect((await POST(request(secret))).status).toBe(401);
  vi.stubEnv('MATCHING_RUNNER_SECRET', secret);
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request('b'.repeat(64)))).status).toBe(401);
  const disabled = await POST(request(secret));
  expect(disabled.status).toBe(200);
  expect((await disabled.json()).data).toEqual({ processed: false });
});
