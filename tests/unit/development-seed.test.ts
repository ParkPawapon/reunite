import { describe, expect, it } from 'vitest';
import { assertLocalSeedTarget } from '../../packages/database/src/development-seed';

const local = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://local:unused@localhost/lost_found',
  APP_BASE_URL: 'http://localhost:3000',
};

describe('local seed target safeguards', () => {
  it('refuses production even with an explicit flag', () => {
    expect(() =>
      assertLocalSeedTarget({ ...local, NODE_ENV: 'production' }, [
        '--development-only',
      ]),
    ).toThrow('Local seed');
  });
  it('requires the explicit development flag', () => {
    expect(() => assertLocalSeedTarget(local, [])).toThrow('Local seed');
  });
  it('refuses remote database and application targets', () => {
    expect(() =>
      assertLocalSeedTarget(
        {
          ...local,
          DATABASE_URL: 'postgresql://local:unused@db.example.test/lost_found',
        },
        ['--development-only'],
      ),
    ).toThrow('loopback');
    expect(() =>
      assertLocalSeedTarget(
        { ...local, APP_BASE_URL: 'https://app.example.test' },
        ['--development-only'],
      ),
    ).toThrow('loopback');
  });
  it('refuses connection host overrides in a loopback URL', () => {
    expect(() =>
      assertLocalSeedTarget(
        {
          ...local,
          DATABASE_URL: local.DATABASE_URL + '?host=db.example.test',
        },
        ['--development-only'],
      ),
    ).toThrow('query overrides');
  });
});
