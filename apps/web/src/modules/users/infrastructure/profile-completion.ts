import 'server-only';

export const profileCompletionRequired = `(
  microsoft_tenant_id IS NOT NULL
  AND profile_completed_at IS NULL
)`;
