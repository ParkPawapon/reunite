import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError } from '@campus/shared';
import { serverConfig } from '@/config/server';
import { services } from '@/lib/composition';
import { readSessionToken } from '@/lib/security/session';
import { loginPath } from './login-destination';

export async function requirePageUser(destination = '/dashboard') {
  const session = await requirePageSession(destination);
  if (session.profileCompletionRequired) redirect('/complete-profile');
  return session.profile;
}

export async function requirePageSession(destination = '/dashboard') {
  // Enter request-time rendering before reading deployment-only configuration.
  const requestHeaders = await headers();
  const config = serverConfig();
  const token = readSessionToken(
    new Request(config.APP_BASE_URL, {
      headers: { cookie: requestHeaders.get('cookie') ?? '' },
    }),
    config.SESSION_COOKIE_NAME,
  );
  if (!token) redirect(loginPath(destination));
  try {
    return await services().auth.requireSession(token);
  } catch (error) {
    if (error instanceof AppError && error.status === 401)
      redirect(loginPath(destination));
    throw error;
  }
}
