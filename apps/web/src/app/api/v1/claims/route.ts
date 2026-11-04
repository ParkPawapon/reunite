import { handlers } from '@/lib/http/handlers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handlers.listClaims;
export const POST = handlers.createClaim;
