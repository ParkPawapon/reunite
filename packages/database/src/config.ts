import { z } from 'zod';

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.url().refine((url) => {
    try {
      return ['postgres:', 'postgresql:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  }, 'Expected a PostgreSQL URL'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_SSL: z.enum(['disable', 'verify-full']).default('disable'),
  DB_SSL_CA: z.string().optional(),
});
export function databaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = databaseEnvSchema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid database environment: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  const config = result.data;
  // URL SSL options can override pg's explicit TLS settings; require one configuration path.
  const url = new URL(config.DATABASE_URL);
  if (
    [
      'ssl',
      'sslmode',
      'sslcert',
      'sslkey',
      'sslrootcert',
      'uselibpqcompat',
    ].some((key) => url.searchParams.has(key))
  ) {
    throw new Error(
      'Use DB_SSL and DB_SSL_CA instead of database URL SSL options',
    );
  }
  return {
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    query_timeout: 6000,
    ssl:
      config.DB_SSL === 'verify-full'
        ? {
            rejectUnauthorized: true,
            ...(config.DB_SSL_CA
              ? { ca: config.DB_SSL_CA.replaceAll('\\n', '\n') }
              : {}),
          }
        : false,
  };
}
