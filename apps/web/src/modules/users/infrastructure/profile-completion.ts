import 'server-only';

export const profileCompletionRequired = `(
  microsoft_tenant_id IS NOT NULL
  AND (first_name IS NULL OR last_name IS NULL OR student_id IS NULL)
)`;
