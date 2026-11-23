import 'server-only';
import { AppError } from '@campus/shared';
import { microsoftConfig } from '@/config/microsoft';
import { serverConfig } from '@/config/server';
import { services } from '@/lib/composition';
import {
  logMicrosoftAccessDenied,
  logMicrosoftSignInFailure,
} from '@/lib/observability/logger';
import { assertSameOrigin } from '@/lib/security/origin';
import { readSessionToken, sessionCookie } from '@/lib/security/session';
import {
  finishMicrosoftAuthorization,
  MicrosoftAccessDenied,
  MICROSOFT_CALLBACK,
  MICROSOFT_TRANSACTION_TTL,
  readMicrosoftTransaction,
  startMicrosoftAuthorization,
} from '@/modules/auth/infrastructure/microsoft-oidc';
import {
  loginDestination,
  loginPath,
} from '@/modules/auth/presentation/login-destination';
import { api } from './api';

const transactionCookieName = (secure: boolean) =>
  secure ? '__Host-reunite.microsoft' : 'reunite.microsoft';

function transactionCookie(value: string, secure: boolean) {
  return sessionCookie(
    transactionCookieName(secure),
    value,
    value ? MICROSOFT_TRANSACTION_TTL : 0,
    secure,
  );
}

function readTransactionCookie(request: Request, secure: boolean) {
  const prefix = transactionCookieName(secure) + '=';
  const matches = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  return matches.length === 1 ? matches[0]?.slice(prefix.length) : undefined;
}

function redirectTo(location: URL, cookie?: string) {
  const response = new Response(null, {
    status: 303,
    headers: { Location: location.href, 'Referrer-Policy': 'no-referrer' },
  });
  if (cookie) response.headers.append('Set-Cookie', cookie);
  return response;
}

export const startMicrosoft = (request: Request) =>
  api(request, async () => {
    const { APP_BASE_URL: origin, NODE_ENV: environment } = serverConfig();
    assertSameOrigin(request, origin);
    const secure =
      environment === 'production' || new URL(origin).protocol === 'https:';
    const next = loginDestination(
      new URL(request.url).searchParams.get('next'),
    );
    let stage: 'configuration' | 'authorization' = 'configuration';
    try {
      const settings = microsoftConfig();
      if (!settings || (secure && new URL(origin).protocol !== 'https:'))
        throw new Error('Microsoft sign-in is unavailable');
      stage = 'authorization';
      const result = await startMicrosoftAuthorization(
        settings,
        new URL(MICROSOFT_CALLBACK, origin),
        next,
      );
      return redirectTo(
        result.authorization,
        transactionCookie(result.cookie, secure),
      );
    } catch {
      logMicrosoftSignInFailure(stage);
      return redirectTo(
        new URL(
          loginPath(next, stage === 'configuration' ? 'unavailable' : 'failed'),
          origin,
        ),
      );
    }
  });

export const callbackMicrosoft = (request: Request) =>
  api(request, async () => {
    const config = serverConfig();
    const origin = config.APP_BASE_URL;
    const secure =
      config.NODE_ENV === 'production' || new URL(origin).protocol === 'https:';
    let next = '/dashboard';
    let matchedTransaction = false;
    const reject = (error: string) =>
      redirectTo(
        new URL(loginPath(next, error), origin),
        matchedTransaction ? transactionCookie('', secure) : undefined,
      );
    let stage: 'configuration' | 'authorization' | 'session' = 'configuration';
    try {
      const settings = microsoftConfig();
      if (!settings || (secure && new URL(origin).protocol !== 'https:'))
        return reject('unavailable');
      stage = 'authorization';
      const transaction = readMicrosoftTransaction(
        readTransactionCookie(request, secure),
        settings,
      );
      if (!transaction) return reject('failed');
      const callback = new URL(MICROSOFT_CALLBACK, origin);
      callback.search = new URL(request.url).search;
      if (
        new Set(callback.searchParams.keys()).size !==
          [...callback.searchParams.keys()].length ||
        callback.searchParams.get('state') !== transaction.state
      )
        return reject('failed');
      matchedTransaction = true;
      next = loginDestination(transaction.destination);
      const providerError = callback.searchParams.get('error');
      if (providerError)
        return reject(
          providerError === 'access_denied' ? 'cancelled' : 'failed',
        );
      const identity = await finishMicrosoftAuthorization(
        settings,
        callback,
        transaction,
      );
      stage = 'session';
      const ttl = config.SESSION_TTL_DAYS * 86400;
      const result = await services().auth.loginWithMicrosoft(
        identity,
        ttl,
        readSessionToken(request, config.SESSION_COOKIE_NAME),
      );
      const response = redirectTo(
        new URL(
          result.profileCompletionRequired ? '/complete-profile' : next,
          origin,
        ),
        transactionCookie('', secure),
      );
      response.headers.append(
        'Set-Cookie',
        sessionCookie(config.SESSION_COOKIE_NAME, result.token, ttl, secure),
      );
      return response;
    } catch (error) {
      if (error instanceof MicrosoftAccessDenied) {
        logMicrosoftAccessDenied(error.reason, error.claims);
        return reject('denied');
      }
      if (error instanceof AppError && error.code === 'CONFLICT')
        return reject('conflict');
      logMicrosoftSignInFailure(stage);
      return reject(stage === 'configuration' ? 'unavailable' : 'failed');
    }
  });
