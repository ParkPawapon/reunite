ALTER TABLE users ADD COLUMN profile_completed_at TIMESTAMPTZ;

-- Preserve completion for Microsoft accounts that met the previous setup rules.
UPDATE users SET profile_completed_at = CURRENT_TIMESTAMP
WHERE microsoft_tenant_id IS NOT NULL
  AND first_name IS NOT NULL AND last_name IS NOT NULL AND student_id IS NOT NULL;
