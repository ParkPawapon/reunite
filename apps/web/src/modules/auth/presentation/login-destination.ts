const protectedPaths = new Set([
  '/dashboard',
  '/map',
  '/profile',
  '/reports/mine',
  '/reports/new',
  '/matches',
]);

export function loginDestination(next: string | null, fragment = ''): string {
  if (next === 'map' || next === '/map') next = `/map${fragment}`;
  if (
    !next ||
    next.length > 512 ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    /[\\\s\u0000-\u001f\u007f]/u.test(next)
  )
    return '/dashboard';
  const { pathname, search, hash } = new URL(next, 'https://reunite.invalid');
  if (
    !protectedPaths.has(pathname) &&
    !/^\/matches\/[1-9]\d{0,9}$/.test(pathname)
  )
    return '/dashboard';
  return pathname + search + hash;
}

export function loginPath(destination: string, error?: string) {
  const query = new URLSearchParams();
  const next = loginDestination(destination);
  if (next !== '/dashboard') query.set('next', next === '/map' ? 'map' : next);
  if (error) query.set('microsoft', error);
  return query.size ? `/login?${query}` : '/login';
}
