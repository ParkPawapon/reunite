-- Preserve legacy display names and accounts; personal fields remain unknown until supplied.
ALTER TABLE users
  ALTER COLUMN name TYPE VARCHAR(201),
  ADD COLUMN first_name VARCHAR(100),
  ADD COLUMN last_name VARCHAR(100),
  ADD COLUMN student_id VARCHAR(20),
  ADD COLUMN faculty VARCHAR(180),
  ADD COLUMN department VARCHAR(180),
  ADD COLUMN major VARCHAR(180),
  ADD COLUMN avatar_data BYTEA,
  ADD COLUMN avatar_version VARCHAR(64),
  ADD CONSTRAINT users_first_name_valid CHECK (first_name IS NULL OR trim_boundary_whitespace(first_name) <> ''),
  ADD CONSTRAINT users_last_name_valid CHECK (last_name IS NULL OR trim_boundary_whitespace(last_name) <> ''),
  ADD CONSTRAINT users_student_id_valid CHECK (student_id IS NULL OR student_id ~ '^[0-9]{8,20}$'),
  ADD CONSTRAINT users_faculty_valid CHECK (faculty IS NULL OR trim_boundary_whitespace(faculty) <> ''),
  ADD CONSTRAINT users_department_valid CHECK (department IS NULL OR trim_boundary_whitespace(department) <> ''),
  ADD CONSTRAINT users_major_valid CHECK (major IS NULL OR trim_boundary_whitespace(major) <> ''),
  ADD CONSTRAINT users_avatar_valid CHECK (
    (avatar_data IS NULL AND avatar_version IS NULL) OR
    (avatar_data IS NOT NULL AND avatar_version IS NOT NULL
      AND octet_length(avatar_data) BETWEEN 1 AND 131072
      AND avatar_version ~ '^[0-9a-f]{64}$')
  );

-- Only populated identifiers participate; unknown legacy values are not fabricated.
CREATE UNIQUE INDEX users_student_id_unique ON users (student_id) WHERE student_id IS NOT NULL;
