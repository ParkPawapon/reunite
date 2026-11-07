'use client';

export async function submitLogout(signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  const body: unknown = await response.json();
  if (
    !response.ok ||
    !body ||
    typeof body !== 'object' ||
    !('data' in body) ||
    !body.data ||
    typeof body.data !== 'object' ||
    !('loggedOut' in body.data) ||
    body.data.loggedOut !== true
  )
    throw new Error('Logout failed');
}
