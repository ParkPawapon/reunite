-- Migration 0008: Add claim review resolution note and reviewer tracking
ALTER TABLE claims
  ADD COLUMN resolution_note TEXT,
  ADD COLUMN resolved_by INTEGER REFERENCES users (user_id),
  ADD CONSTRAINT claims_resolution_note_length CHECK (resolution_note IS NULL OR length(trim(resolution_note)) <= 1000);

CREATE INDEX claims_report_status_idx ON claims (report_id, status);

COMMENT ON COLUMN claims.resolution_note IS 'Optional note provided by the report owner when approving or rejecting the claim.';
COMMENT ON COLUMN claims.resolved_by IS 'User ID of the report owner who approved or rejected the claim.';
