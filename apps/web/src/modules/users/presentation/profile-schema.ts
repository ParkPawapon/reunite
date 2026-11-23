import { z } from 'zod';
import { normalizeEmail } from '@campus/shared';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !value.includes('\0'))
    .transform((value) => value || null)
    .nullable();
export const profileNameSchema = z
  .string()
  .trim()
  .transform((name) =>
    name.replace(/\p{L}[\p{L}\p{M}]*/gu, (part) => {
      const word = part === part.toUpperCase() ? part.toLowerCase() : part;
      return word.replace(/^\p{L}/u, (first) => first.toUpperCase());
    }),
  )
  .pipe(
    z
      .string()
      .min(1)
      .max(100)
      .refine((value) => !value.includes('\0')),
  );
const studentId = /^[0-9]{8,20}$/;
const educationFields = z.object({
  studentId: optionalText(20).refine(
    (value) => value === null || studentId.test(value),
  ),
  faculty: optionalText(180),
  department: optionalText(180),
  major: optionalText(180),
});
export const profileCompletionSchema = educationFields.strict().partial();
export const profileSchema = z
  .object({
    firstName: profileNameSchema,
    lastName: profileNameSchema,
    email: z.string().transform(normalizeEmail).pipe(z.email().max(255)),
    ...educationFields.shape,
    phone: optionalText(20).refine(
      (value) => value === null || /^\+?[0-9][0-9 ()-]{5,19}$/.test(value),
    ),
    currentPassword: z.string().min(1).max(1024).optional(),
  })
  .strict();
