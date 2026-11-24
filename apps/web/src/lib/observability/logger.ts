import 'server-only';
import type { MicrosoftAccessDenied } from '@/modules/auth/infrastructure/microsoft-oidc';

export function logMatchingFailure() {
  if (process.env.LOG_LEVEL !== 'silent')
    console.error(
      JSON.stringify({ level: 'error', event: 'matching_worker_unavailable' }),
    );
}

export function logMatchingProviderFailure(entry: {
  provider: string;
  code: string;
  retryable: boolean;
  httpStatus?: number;
  stage?: string;
  detail?: string;
}) {
  // Strictly non-sensitive technical metadata; never log keys, prompts, bodies, or report data.
  const level = process.env.LOG_LEVEL ?? 'info';
  if (level === 'silent') return;
  const isError = !entry.retryable || entry.code === 'PROVIDER_REJECTED';
  if (level === 'error' && !isError) return;
  const payload = JSON.stringify({
    level: isError ? 'error' : 'info',
    event: 'matching_provider_failed',
    ...entry,
  });
  if (isError) console.error(payload);
  else console.info(payload);
}

export function logMicrosoftSignInFailure(
  stage: 'configuration' | 'authorization' | 'session',
) {
  if (process.env.LOG_LEVEL !== 'silent')
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'microsoft_sign_in_failed',
        stage,
      }),
    );
}

export function logMicrosoftAccessDenied(
  reason: MicrosoftAccessDenied['reason'],
  claims?: MicrosoftAccessDenied['claims'],
) {
  if ((process.env.LOG_LEVEL ?? 'info') === 'info')
    console.info(
      JSON.stringify({
        level: 'info',
        event: 'microsoft_access_denied',
        reason,
        claims,
      }),
    );
}

export function logRequest(entry: {
  requestId: string;
  method: string;
  status: number;
  durationMs: number;
}) {
  // Deliberately omit URL/query, headers, request body and exception details.
  const level = process.env.LOG_LEVEL ?? 'info';
  if (level === 'silent' || (level === 'error' && entry.status < 500)) return;
  const message = JSON.stringify({
    level: entry.status >= 500 ? 'error' : 'info',
    event: 'http_request',
    ...entry,
  });
  if (entry.status >= 500) console.error(message);
  else console.info(message);
}
