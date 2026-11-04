import { describe, expect, it } from 'vitest';
import {
  reportCreateSchema,
  reportPatchSchema,
  reportFilterSchema,
} from '@/modules/item-reports/presentation/schemas';
import { claimCreateSchema } from '@/modules/claims/presentation/schemas';
import { loginSchema } from '@/modules/auth/presentation/schemas';

const valid = {
  categoryId: 1,
  locationId: 1,
  type: 'LOST',
  title: 'กระเป๋า',
  eventDatetime: '2026-11-04T12:30:00+07:00',
};
describe('boundary validation', () => {
  it('accepts documented enums and timezone-aware dates', () =>
    expect(reportCreateSchema.safeParse(valid).success).toBe(true));
  it.each([
    { title: '' },
    { title: 'a'.repeat(256) },
    { type: 'OTHER' },
    { eventDatetime: 'yesterday' },
    { eventDatetime: '2026-02-30T10:00:00Z' },
    { eventDatetime: '2026-11-04T10:00:00' },
    { categoryId: true },
    { userId: 5 },
    { status: 'CLOSED' },
    { image: 'javascript:alert(1)' },
    { image: '//evil.test/image' },
  ])('rejects invalid creation input %j', (changes) =>
    expect(reportCreateSchema.safeParse({ ...valid, ...changes }).success).toBe(
      false,
    ),
  );
  it('requires fields and rejects unsafe patch fields', () => {
    expect(reportCreateSchema.safeParse({}).success).toBe(false);
    expect(
      reportCreateSchema.safeParse({ ...valid, createdAt: valid.eventDatetime })
        .success,
    ).toBe(false);
    expect(
      reportPatchSchema.safeParse({ updatedAt: valid.eventDatetime }).success,
    ).toBe(false);
    for (const patch of [
      {},
      { status: 'RESOLVED' },
      { userId: 2 },
      { eventDatetime: valid.eventDatetime },
      { type: 'FOUND' },
    ])
      expect(reportPatchSchema.safeParse(patch).success).toBe(false);
    expect(reportPatchSchema.parse({ description: null })).toEqual({
      description: null,
    });
  });
  it('bounds pagination and rejects invalid status or SQL-like input', () => {
    expect(reportFilterSchema.parse({})).toEqual({ limit: 20, offset: 0 });
    for (const filter of [
      { limit: '101' },
      { offset: '-1' },
      { status: 'APPROVED' },
      { categoryId: '1; DROP TABLE users;--' },
      { sort: 'title' },
    ])
      expect(reportFilterSchema.safeParse(filter).success).toBe(false);
  });
  it('protects claim status/identity and evidence bounds', () => {
    expect(
      claimCreateSchema.safeParse({ reportId: 1, evidence: '' }).success,
    ).toBe(false);
    expect(
      claimCreateSchema.safeParse({ reportId: 1, evidence: 'a'.repeat(10001) })
        .success,
    ).toBe(false);
    expect(
      claimCreateSchema.safeParse({
        reportId: 1,
        evidence: 'receipt',
        status: 'APPROVED',
      }).success,
    ).toBe(false);
    expect(
      claimCreateSchema.safeParse({
        reportId: 1,
        evidence: 'receipt',
        updatedAt: valid.eventDatetime,
      }).success,
    ).toBe(false);
    expect(
      claimCreateSchema.parse({ reportId: 1, evidence: 'receipt' }),
    ).toEqual({ reportId: 1, evidence: 'receipt' });
  });
  it('validates email and bounds password without trimming it', () => {
    expect(
      loginSchema.safeParse({ email: 'not-email', password: 'secret' }).success,
    ).toBe(false);
    expect(
      loginSchema.parse({ email: 'ME@EXAMPLE.COM', password: ' secret ' }),
    ).toEqual({ email: 'me@example.com', password: ' secret ' });
  });
});
