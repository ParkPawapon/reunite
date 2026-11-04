import { expect, it, vi } from 'vitest';
import { api, jsonBody } from '@/lib/http/api';
import { createHandlers } from '@/lib/http/handlers';

process.env.LOG_LEVEL = 'silent';
it('liveness never touches dependencies; readiness returns sanitized 503', async () => {
  const services = vi.fn(() => {
    throw new Error('not called');
  });
  const handlers = createHandlers({
    services,
    ping: async () => {
      throw new Error('postgres://secret:password@host');
    },
  });
  expect(
    (await handlers.live(new Request('http://localhost/api'))).status,
  ).toBe(200);
  expect(services).not.toHaveBeenCalled();
  const ready = await handlers.ready(new Request('http://localhost/api'));
  expect(ready.status).toBe(503);
  expect(await ready.text()).not.toContain('password');
});
it('sanitizes unknown/database errors and never trusts caller request IDs', async () => {
  const request = new Request('http://localhost', {
    headers: { 'x-request-id': 'untrusted' },
  });
  const response = await api(request, async () => {
    throw new Error('SELECT private evidence password_hash');
  });
  expect(response.status).toBe(500);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-request-id')).not.toBe('untrusted');
  expect(await response.text()).not.toMatch(/SELECT|evidence|password_hash/);
});
it('rejects malformed JSON, unsupported types and oversized streams', async () => {
  const req = (body: string, type = 'application/json') =>
    new Request('http://localhost', {
      method: 'POST',
      body,
      headers: { 'content-type': type },
    });
  await expect(jsonBody(req('{'))).rejects.toMatchObject({ status: 400 });
  await expect(jsonBody(req('{}', 'text/plain'))).rejects.toMatchObject({
    status: 415,
  });
  await expect(jsonBody(req('x'.repeat(32769)))).rejects.toMatchObject({
    status: 413,
  });
});
