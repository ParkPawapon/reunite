import { z } from 'zod';
import { normalizeEmail } from '@campus/shared';
export const loginSchema = z.strictObject({
  email: z.string().transform(normalizeEmail).pipe(z.email().max(255)),
  password: z.string().min(1).max(128),
});
