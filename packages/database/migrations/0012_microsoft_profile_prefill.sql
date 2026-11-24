ALTER TABLE users
  ADD COLUMN microsoft_student_id_draft VARCHAR(20),
  ADD CONSTRAINT users_microsoft_student_id_draft_valid CHECK (
    microsoft_student_id_draft IS NULL OR (
      microsoft_tenant_id IS NOT NULL AND student_id IS NULL
      AND microsoft_student_id_draft ~ '^[0-9]{8,20}$'
    )
  );
