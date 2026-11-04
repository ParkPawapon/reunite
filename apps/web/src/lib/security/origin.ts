import { AppError } from '@campus/shared';

export function assertSameOrigin(request: Request, baseUrl: string) {
  const origin = request.headers.get('origin');
  if (
    !origin ||
    origin !== new URL(baseUrl).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new AppError('FORBIDDEN', 403, 'A same-origin request is required');
  }
}
