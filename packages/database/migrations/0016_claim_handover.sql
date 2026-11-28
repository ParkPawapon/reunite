ALTER TABLE claims
  ADD COLUMN finder_confirmed_at TIMESTAMPTZ,
  ADD COLUMN claimant_confirmed_at TIMESTAMPTZ,
  ADD CONSTRAINT claims_handover_requires_approval CHECK (
    status = 'APPROVED' OR (finder_confirmed_at IS NULL AND claimant_confirmed_at IS NULL)
  );

ALTER TABLE notifications
  DROP CONSTRAINT notifications_target_valid,
  ADD CONSTRAINT notifications_target_valid CHECK (
    (report_id IS NULL AND match_id IS NULL AND kind IN ('PROFILE_UPDATED', 'AVATAR_UPDATED', 'MATCH_SUGGESTED'))
    OR (report_id IS NULL AND match_id IS NOT NULL AND kind IN ('MATCH_SUGGESTED', 'MATCH_PARTNER_CONFIRMED', 'MATCH_RETURNED'))
    OR (report_id IS NOT NULL AND match_id IS NULL AND kind IN (
      'CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_PARTNER_CONFIRMED', 'CLAIM_RETURNED'
    ))
  );
