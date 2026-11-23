import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as oidc from 'openid-client';
import { z } from 'zod';
import { AppError, normalizeEmail } from '@campus/shared';
import { entraId, type microsoftConfig } from '@/config/microsoft';
import type { MicrosoftIdentity } from '../domain/auth';

type Settings = NonNullable<ReturnType<typeof microsoftConfig>>;
export const MICROSOFT_CALLBACK = '/api/v1/auth/microsoft/callback';
export const MICROSOFT_TRANSACTION_TTL = 600;
const secretValue = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const transactionSchema = z.object({
  state: secretValue,
  nonce: secretValue,
  verifier: secretValue,
  destination: z.string().max(512),
  issuedAt: z.number().int(),
});
type Transaction = z.infer<typeof transactionSchema>;

const authority = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/v2.0`;

let connection:
  { settings: Settings; pending: Promise<oidc.Configuration> } | undefined;
function configuration(settings: Settings) {
  if (
    connection &&
    connection.settings.tenantId === settings.tenantId &&
    connection.settings.clientId === settings.clientId &&
    connection.settings.clientSecret === settings.clientSecret
  )
    return connection.pending;

  const pending = oidc
    .discovery(
      new URL(authority(settings.tenantId)),
      settings.clientId,
      {
        id_token_signed_response_alg: 'RS256',
        token_endpoint_auth_method: 'client_secret_post',
      },
      oidc.ClientSecretPost(settings.clientSecret),
      { execute: [oidc.enableNonRepudiationChecks] },
    )
    .catch((error: unknown) => {
      if (connection?.pending === pending) connection = undefined;
      throw error;
    });
  connection = { settings, pending };
  return pending;
}

function signature(value: string, settings: Settings) {
  return createHmac('sha256', settings.clientSecret)
    .update(
      `reunite:microsoft-oidc:${settings.tenantId}:${settings.clientId}:${value}`,
    )
    .digest();
}

export function readMicrosoftTransaction(
  value: string | undefined,
  settings: Settings,
) {
  if (!value || value.length > 4096) return null;
  const [payload, mac, extra] = value.split('.');
  if (
    !payload ||
    !mac ||
    extra !== undefined ||
    !secretValue.safeParse(mac).success
  )
    return null;
  const expected = signature(payload, settings);
  const supplied = Buffer.from(mac, 'base64url');
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  const result = transactionSchema.safeParse(
    JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown,
  );
  if (!result.success) return null;
  const age = Date.now() - result.data.issuedAt;
  return age >= 0 && age < MICROSOFT_TRANSACTION_TTL * 1000
    ? result.data
    : null;
}

export async function startMicrosoftAuthorization(
  settings: Settings,
  callback: URL,
  destination: string,
) {
  const config = await configuration(settings);
  const transaction: Transaction = {
    destination,
    issuedAt: Date.now(),
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier: oidc.randomPKCECodeVerifier(),
  };
  const authorization = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callback.href,
    scope: 'openid profile',
    response_mode: 'query',
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(transaction.verifier),
    code_challenge_method: 'S256',
  });
  const payload = Buffer.from(JSON.stringify(transaction)).toString(
    'base64url',
  );
  const cookie = `${payload}.${signature(payload, settings).toString('base64url')}`;
  return { authorization, cookie };
}

export async function finishMicrosoftAuthorization(
  settings: Settings,
  callback: URL,
  transaction: Transaction,
) {
  const tokens = await oidc.authorizationCodeGrant(
    await configuration(settings),
    callback,
    {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.verifier,
    },
  );
  return requireKmuttIdentity(tokens.claims(), settings.tenantId);
}

const identityClaims = z.object({
  tid: entraId,
  oid: entraId,
  upn: z.string(),
  acct: z.union([z.number(), z.string()]),
  idp: z.string().optional(),
});

export class MicrosoftAccessDenied extends AppError {
  constructor(
    readonly reason:
      | 'invalid_claims'
      | 'tenant_mismatch'
      | 'not_member'
      | 'external_identity_provider'
      | 'invalid_kmutt_upn',
    readonly claims?: (keyof typeof identityClaims.shape)[],
  ) {
    super('MICROSOFT_ACCESS_DENIED', 403, 'A KMUTT member account is required');
  }
}

/** Authorize claims from a fully verified Entra ID token. */
export function requireKmuttIdentity(
  claims: unknown,
  tenantId: string,
): MicrosoftIdentity {
  const parsed = identityClaims.safeParse(claims);
  if (!parsed.success) {
    const invalid = Object.keys(
      identityClaims.shape,
    ) as (keyof typeof identityClaims.shape)[];
    throw new MicrosoftAccessDenied(
      'invalid_claims',
      invalid.filter((claim) =>
        parsed.error.issues.some((issue) => issue.path[0] === claim),
      ),
    );
  }
  const { tid, oid, upn, acct, idp } = parsed.data;
  if (tid.toLowerCase() !== tenantId)
    throw new MicrosoftAccessDenied('tenant_mismatch');
  if (acct !== 0 && acct !== '0') throw new MicrosoftAccessDenied('not_member');
  if (
    idp !== undefined &&
    idp !== authority(tenantId) &&
    idp !== `https://sts.windows.net/${tenantId}/`
  )
    throw new MicrosoftAccessDenied('external_identity_provider');

  const email = normalizeEmail(upn);
  const [username, domain, extra] = email.split('@');
  if (
    email.length > 255 ||
    !username ||
    /#ext#|[\s\u0000-\u001f\u007f]/u.test(username) ||
    domain !== 'kmutt.ac.th' ||
    extra !== undefined
  )
    throw new MicrosoftAccessDenied('invalid_kmutt_upn');
  return {
    tenantId,
    objectId: oid.toLowerCase(),
    email,
    name: Array.from(username).slice(0, 100).join(''),
  };
}
