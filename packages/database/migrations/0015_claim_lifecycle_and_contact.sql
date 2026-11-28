-- Stop report writes before closing duplicate requests. Keep all evidence.
LOCK TABLE item_reports IN ACCESS EXCLUSIVE MODE;
LOCK TABLE claims IN SHARE ROW EXCLUSIVE MODE;

WITH duplicates AS (
  SELECT claim_id, row_number() OVER (
    PARTITION BY report_id, user_id ORDER BY claim_date, claim_id
  ) AS position
  FROM claims WHERE status = 'PENDING'
)
UPDATE claims c SET status = 'REJECTED',
  resolution_note = 'ปิดคำร้องซ้ำ โดยคำร้องแรกยังอยู่ระหว่างพิจารณา'
FROM duplicates d WHERE c.claim_id = d.claim_id AND d.position > 1;

CREATE UNIQUE INDEX claims_one_pending_idx ON claims (report_id, user_id)
  WHERE status = 'PENDING';

ALTER TABLE item_reports
  ADD COLUMN share_contact_email BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_contact_phone BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE notifications
  ADD COLUMN report_id INTEGER REFERENCES item_reports(report_id) ON DELETE RESTRICT,
  DROP CONSTRAINT notifications_kind_check,
  DROP CONSTRAINT notifications_match_valid,
  ADD CONSTRAINT notifications_target_valid CHECK (
    (report_id IS NULL AND match_id IS NULL AND kind IN ('PROFILE_UPDATED', 'AVATAR_UPDATED', 'MATCH_SUGGESTED'))
    OR (report_id IS NULL AND match_id IS NOT NULL AND kind IN ('MATCH_SUGGESTED', 'MATCH_PARTNER_CONFIRMED', 'MATCH_RETURNED'))
    OR (report_id IS NOT NULL AND match_id IS NULL AND kind IN ('CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED'))
  );
CREATE INDEX notifications_report_idx ON notifications (report_id) WHERE report_id IS NOT NULL;
