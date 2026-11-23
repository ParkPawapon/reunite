import { z } from 'zod';
import { normalizeEmail } from '@campus/shared';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();
const name = z.string().trim().min(1).max(100);
const studentId = /^[0-9]{8,20}$/;
export const profileCompletionSchema = z.strictObject({
  firstName: name,
  lastName: name,
  studentId: z.string().trim().regex(studentId),
});
export const profileSchema = z
  .object({
    firstName: name,
    lastName: name,
    email: z.string().transform(normalizeEmail).pipe(z.email().max(255)),
    studentId: optionalText(20).refine(
      (value) => value === null || studentId.test(value),
    ),
    faculty: optionalText(180),
    department: optionalText(180),
    major: optionalText(180),
    phone: optionalText(20).refine(
      (value) => value === null || /^\+?[0-9][0-9 ()-]{5,19}$/.test(value),
    ),
    currentPassword: z.string().min(1).max(1024).optional(),
  })
  .strict();
