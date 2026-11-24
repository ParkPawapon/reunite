ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN microsoft_tenant_id uuid,
  ADD COLUMN microsoft_object_id uuid,
  ADD CONSTRAINT users_microsoft_identity_complete CHECK (
    (microsoft_tenant_id IS NULL) = (microsoft_object_id IS NULL)
  ),
  ADD CONSTRAINT users_microsoft_identity_unique UNIQUE (microsoft_tenant_id, microsoft_object_id),
  ADD CONSTRAINT users_sign_in_method_required CHECK (
    password_hash IS NOT NULL OR microsoft_tenant_id IS NOT NULL
  );
