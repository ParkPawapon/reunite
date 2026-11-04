import { describe, expect, it } from 'vitest';
import { databaseConfig } from '../../packages/database/src/config';
import { serverEnvSchema } from '@/config/server';

describe('environment safety', () => {
  const url = 'postgresql://example:secret@localhost:5432/test';
  it('bounds pool sizes and reports invalid keys without secret values', () => {
    expect(databaseConfig({ DATABASE_URL: url }).max).toBe(10);
    expect(() =>
      databaseConfig({ DATABASE_URL: url, DB_POOL_MAX: '51' }),
    ).toThrow('DB_POOL_MAX');
    expect(() =>
      databaseConfig({ DATABASE_URL: 'not a url with secret' }),
    ).toThrow('DATABASE_URL');
    try {
      databaseConfig({ DATABASE_URL: 'secret' });
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });
  it('keeps TLS certificate verification enabled and rejects pg URL overrides', () => {
    expect(
      databaseConfig({ DATABASE_URL: url, DB_SSL: 'verify-full' }).ssl,
    ).toEqual({ rejectUnauthorized: true });
    for (const key of [
      'ssl',
      'sslmode',
      'sslcert',
      'sslkey',
      'sslrootcert',
      'uselibpqcompat',
    ]) {
      expect(() =>
        databaseConfig({
          DATABASE_URL: `${url}?${key}=no-verify`,
          DB_SSL: 'verify-full',
        }),
      ).toThrow('DB_SSL');
    }
  });
  it('accepts only an origin and header-safe cookie configuration', () => {
    expect(
      serverEnvSchema.safeParse({ APP_BASE_URL: 'https://example.test' })
        .success,
    ).toBe(true);
    for (const value of [
      'invalid url',
      'https://example.test/path',
      'ftp://example.test',
      'https://secret@example.test',
      'https://example.test?query=1',
    ])
      expect(serverEnvSchema.safeParse({ APP_BASE_URL: value }).success).toBe(
        false,
      );
    expect(
      serverEnvSchema.safeParse({
        APP_BASE_URL: 'https://example.test',
        SESSION_COOKIE_NAME: 'bad;name',
      }).success,
    ).toBe(false);
  });
});
