import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

export const createSessionToken = () => randomBytes(32).toString('base64url');
export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function readSessionToken(
  request: Request,
  name: string,
): string | undefined {
  const matches = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  const token = matches[0]?.slice(name.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
export function sessionCookie(
  name: string,
  token: string,
  ttlSeconds: number,
  secure: boolean,
) {
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${secure ? '; Secure' : ''}`;
}
