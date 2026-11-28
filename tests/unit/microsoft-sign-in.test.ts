import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  finishMicrosoftAuthorization,
  MICROSOFT_CALLBACK,
  readMicrosoftTransaction,
  requireKmuttIdentity,
  startMicrosoftAuthorization,
} from '@/modules/auth/infrastructure/microsoft-oidc';
import {
  loginDestination,
  loginPath,
} from '@/modules/auth/presentation/login-destination';
import { microsoftConfig } from '@/config/microsoft';
import {
  callbackMicrosoft,
  startMicrosoft,
} from '@/lib/http/microsoft-handlers';

const { loginWithMicrosoft } = vi.hoisted(() => ({
  loginWithMicrosoft: vi.fn(),
}));
vi.mock('@/lib/composition', () => ({
  services: () => ({ auth: { loginWithMicrosoft } }),
}));

const tenantId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const objectId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const clientId = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const settings = { tenantId, clientId, clientSecret: 'fixture-only' };
const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
const authorizationEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
const jwks = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
const callback = new URL(MICROSOFT_CALLBACK, 'http://localhost:3000');
const claims = {
  tid: tenantId,
  oid: objectId,
  upn: '  MEMBER@KMUTT.AC.TH  ',
  acct: '0',
  name: 'Campus Member',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('KMUTT account authorization', () => {
  it('identifies missing claims without exposing their values', () => {
    expect(() =>
      requireKmuttIdentity(
        { ...claims, acct: undefined, upn: undefined },
        tenantId,
      ),
    ).toThrow(
      expect.objectContaining({
        reason: 'invalid_claims',
        claims: ['upn', 'acct'],
      }),
    );
  });
  it('requires a member and normalizes the directory UPN', () => {
    expect(
      requireKmuttIdentity({ ...claims, name: 'campus MEMBER' }, tenantId),
    ).toEqual({
      tenantId,
      objectId,
      email: 'member@kmutt.ac.th',
      name: 'Campus Member',
    });
  });
  it('reads valid optional names and ignores student ID claims', () => {
    const studentClaims = {
      ...claims,
      given_name: '  campus  ',
      family_name: ' McDonald-SMITH ',
      'extn.studentId': '0123456789',
      student_id: '9999999999',
    };
    expect(requireKmuttIdentity(studentClaims, tenantId)).toMatchObject({
      name: 'Campus McDonald-Smith',
      profileDraft: { firstName: 'Campus', lastName: 'McDonald-Smith' },
    });
    expect(
      requireKmuttIdentity(
        {
          ...studentClaims,
          name: undefined,
          given_name: undefined,
          family_name: undefined,
        },
        tenantId,
      ).name,
    ).toBe('member');
    expect(
      requireKmuttIdentity(
        {
          ...studentClaims,
          given_name: '\0',
          family_name: 7,
          'extn.studentId': 123456789,
        },
        tenantId,
      ).profileDraft,
    ).toBeUndefined();
  });

  it.each([
    { acct: 1 },
    { acct: undefined },
    { oid: 'invalid' },
    { oid: undefined },
    { tid: undefined },
    { tid: objectId },
    {
      upn: undefined,
      email: 'member@kmutt.ac.th',
      preferred_username: 'member@kmutt.ac.th',
    },
    { upn: 'member@hotmail.com' },
    { upn: 'member@other.ac.th' },
    { upn: 'member@@kmutt.ac.th' },
    { upn: 'member@kmutt.ac.th.example' },
    { upn: 'member#EXT#@kmutt.ac.th' },
    { idp: 'live.com' },
    { idp: `https://sts.windows.net/${objectId}/` },
  ])('denies ineligible claims %o', (override) => {
    expect(() =>
      requireKmuttIdentity({ ...claims, ...override }, tenantId),
    ).toThrow(expect.objectContaining({ code: 'MICROSOFT_ACCESS_DENIED' }));
  });
});

it('handles absent or incomplete environment settings', () => {
  expect(microsoftConfig({ MICROSOFT_CLIENT_ID: '' })).toBeNull();
  expect(() => microsoftConfig({ MICROSOFT_CLIENT_ID: clientId })).toThrow(
    'Invalid Microsoft sign-in environment',
  );
});

it('restricts return targets to protected pages and preserves the map fragment', () => {
  for (const next of [
    'https://example.test',
    '//example.test',
    '/\\example.test',
    '/api/v1/auth/logout',
    '/%2fexample.test',
  ]) {
    expect(loginDestination(next)).toBe('/dashboard');
  }
  expect(loginDestination('map', '#from=N7&to=S3')).toBe('/map#from=N7&to=S3');
  expect(loginDestination('/matches/42?before=50')).toBe(
    '/matches/42?before=50',
  );
  expect(loginPath('/map')).toBe('/login?next=map');
});

it('uses the verified authorization code flow and rejects invalid responses', async () => {
  const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = {
    ...key.publicKey.export({ format: 'jwk' }),
    kid: 'test-key',
    alg: 'RS256',
  };
  let tokenClaims: Record<string, unknown>;
  let useWrongKey = false;
  const fetchProvider = vi.fn(async (input: URL, init?: RequestInit) => {
    switch (String(input)) {
      case `${issuer}/.well-known/openid-configuration`:
        return Response.json({
          issuer,
          authorization_endpoint: authorizationEndpoint,
          token_endpoint: tokenEndpoint,
          jwks_uri: jwks,
          id_token_signing_alg_values_supported: ['RS256'],
        });
      case jwks:
        return Response.json({ keys: [jwk] });
      case tokenEndpoint: {
        const params = new URLSearchParams(String(init?.body));
        expect(params.get('code')).toBe('test-code');
        expect(params.get('code_verifier')).toBe(verifier);
        expect(params.get('redirect_uri')).toBe(callback.href);
        expect(params.get('client_secret')).toBe(settings.clientSecret);
        const encoded = [{ alg: 'RS256', kid: jwk.kid }, tokenClaims]
          .map((value) =>
            Buffer.from(JSON.stringify(value)).toString('base64url'),
          )
          .join('.');
        const signature = sign(
          'RSA-SHA256',
          Buffer.from(encoded),
          useWrongKey ? otherKey.privateKey : key.privateKey,
        );
        return Response.json({
          access_token: 'fixture-access-token',
          token_type: 'Bearer',
          id_token: `${encoded}.${signature.toString('base64url')}`,
        });
      }
      default:
        throw new Error('Unexpected provider request');
    }
  });
  vi.stubGlobal('fetch', fetchProvider);
  const result = await startMicrosoftAuthorization(
    settings,
    callback,
    '/profile',
  );
  const transaction = readMicrosoftTransaction(result.cookie, settings);
  expect(transaction?.destination).toBe('/profile');
  expect(readMicrosoftTransaction(`x${result.cookie}`, settings)).toBeNull();
  expect(
    readMicrosoftTransaction(result.cookie, {
      ...settings,
      clientSecret: 'other',
    }),
  ).toBeNull();
  if (!transaction) throw new Error('Missing test transaction');
  const search = result.authorization.searchParams;
  expect(result.authorization.origin + result.authorization.pathname).toBe(
    authorizationEndpoint,
  );
  expect(search.get('response_type')).toBe('code');
  expect(search.get('scope')).toBe('openid profile');
  expect(search.get('state')).toBe(transaction.state);
  expect(search.get('nonce')).toBe(transaction.nonce);
  expect(search.get('code_challenge_method')).toBe('S256');
  expect(search.has('client_secret')).toBe(false);
  const verifier = transaction.verifier;
  const now = Math.floor(Date.now() / 1000);
  const valid = {
    ...claims,
    iss: issuer,
    aud: clientId,
    iat: now,
    exp: now + 60,
    sub: 'subject',
    nonce: transaction.nonce,
  };
  const response = new URL(callback);
  response.search = new URLSearchParams({
    state: transaction.state,
    code: 'test-code',
  }).toString();
  tokenClaims = valid;
  await expect(
    finishMicrosoftAuthorization(settings, response, transaction),
  ).resolves.toMatchObject({ tenantId, objectId });

  vi.stubEnv('APP_BASE_URL', callback.origin);
  vi.stubEnv('LOG_LEVEL', 'silent');
  vi.stubEnv('SESSION_COOKIE_NAME', 'test_session');
  vi.stubEnv('MICROSOFT_CLIENT_ID', settings.clientId);
  vi.stubEnv('MICROSOFT_CLIENT_SECRET', settings.clientSecret);
  vi.stubEnv('MICROSOFT_TENANT_ID', settings.tenantId);
  const start = new URL(
    '/api/v1/auth/microsoft?next=/profile',
    callback.origin,
  );
  expect(
    (
      await startMicrosoft(
        new Request(start, {
          method: 'POST',
          headers: { origin: 'https://example.test' },
        }),
      )
    ).status,
  ).toBe(403);
  const started = await startMicrosoft(
    new Request(start, {
      method: 'POST',
      headers: { origin: callback.origin },
    }),
  );
  expect(started.status).toBe(303);
  const authorizationUrl = new URL(started.headers.get('location') ?? '');
  expect(authorizationUrl.searchParams.getAll('prompt')).toEqual([
    'select_account',
  ]);
  expect(authorizationUrl.searchParams.has('login_hint')).toBe(false);
  expect(authorizationUrl.searchParams.get('state')).not.toBe(
    transaction.state,
  );
  expect(started.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Lax');

  const oldToken = 'x'.repeat(43);
  const headers = {
    cookie: `reunite.microsoft=${result.cookie}; test_session=${oldToken}`,
  };
  const cancelled = new URL(response);
  cancelled.searchParams.delete('code');
  cancelled.searchParams.set('error', 'access_denied');
  const cancellation = await callbackMicrosoft(
    new Request(cancelled, { headers }),
  );
  expect(cancellation.headers.get('location')).toContain('microsoft=cancelled');
  expect(cancellation.headers.getSetCookie()).toHaveLength(1);
  expect(loginWithMicrosoft).not.toHaveBeenCalled();

  tokenClaims = { ...valid, acct: '1' };
  vi.stubEnv('LOG_LEVEL', 'info');
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  expect(
    (await callbackMicrosoft(new Request(response, { headers }))).headers.get(
      'location',
    ),
  ).toContain('microsoft=denied');
  expect(info).toHaveBeenCalledWith(
    JSON.stringify({
      level: 'info',
      event: 'microsoft_access_denied',
      reason: 'not_member',
    }),
  );
  vi.stubEnv('LOG_LEVEL', 'silent');
  expect(loginWithMicrosoft).not.toHaveBeenCalled();
  tokenClaims = valid;
  loginWithMicrosoft.mockResolvedValueOnce({
    token: 'y'.repeat(43),
    profileCompletionRequired: true,
  });
  const onboarding = await callbackMicrosoft(
    new Request(response, { headers }),
  );
  expect(onboarding.headers.get('location')).toBe(
    `${callback.origin}/complete-profile`,
  );
  expect(onboarding.headers.getSetCookie()).toHaveLength(2);
  loginWithMicrosoft.mockClear();
  loginWithMicrosoft.mockResolvedValue({
    token: 'y'.repeat(43),
    profileCompletionRequired: false,
  });
  const completed = await callbackMicrosoft(new Request(response, { headers }));
  expect(completed.headers.get('location')).toBe(`${callback.origin}/profile`);
  expect(completed.headers.get('cache-control')).toBe('no-store');
  expect(completed.headers.getSetCookie()).toEqual([
    'reunite.microsoft=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    expect.stringContaining('test_session=' + 'y'.repeat(43)),
  ]);
  expect(loginWithMicrosoft).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ tenantId, objectId }),
    expect.any(Number),
    oldToken,
  );

  for (const override of [
    { aud: objectId },
    { iss: 'https://example.test' },
    { exp: now - 60 },
    { nonce: 'other' },
    { tid: objectId },
    { acct: '1' },
    { oid: undefined },
  ]) {
    tokenClaims = { ...valid, ...override };
    await expect(
      finishMicrosoftAuthorization(settings, response, transaction),
    ).rejects.toThrow();
  }
  tokenClaims = valid;
  useWrongKey = true;
  await expect(
    finishMicrosoftAuthorization(settings, response, transaction),
  ).rejects.toThrow();
  response.searchParams.set('state', 'other');
  await expect(
    finishMicrosoftAuthorization(settings, response, transaction),
  ).rejects.toThrow();
  vi.useFakeTimers().setSystemTime(Date.now() + 600_000);
  expect(readMicrosoftTransaction(result.cookie, settings)).toBeNull();
});
