import { z } from 'zod';
import { idSchema, paginationSchema } from '@/lib/http/api';

const fields = {
  categoryId: z.number().int().positive().max(2147483647),
  locationId: z.number().int().positive().max(2147483647),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10000).nullable().optional(),
  image: z
    .string()
    .max(500)
    .refine((value) => {
      if (
        value.startsWith('/') &&
        !value.startsWith('//') &&
        !value.includes('\\') &&
        !/[\u0000-\u0020]/.test(value)
      )
        return true;
      try {
        const url = new URL(value);
        return (
          ['https:', 'http:'].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    }, 'Use an HTTP(S) URL or absolute application path')
    .nullable()
    .optional(),
};
export const reportCreateSchema = z.strictObject({
  ...fields,
  type: z.enum(['LOST', 'FOUND']),
  eventDatetime: z.iso.datetime({ offset: true }),
});
export const reportPatchSchema = z
  .strictObject(fields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one safe field',
  );
export const reportFilterSchema = paginationSchema
  .extend({
    type: z.enum(['LOST', 'FOUND']).optional(),
    status: z.enum(['OPEN', 'RESOLVED', 'CLOSED']).optional(),
    categoryId: idSchema.optional(),
    locationId: idSchema.optional(),
  })
  .strict();
