ALTER TABLE report_matches
  ADD COLUMN lost_confirmed_at TIMESTAMPTZ,
  ADD COLUMN found_confirmed_at TIMESTAMPTZ,
  ADD COLUMN returned_at TIMESTAMPTZ,
  ADD CONSTRAINT match_return_has_both_confirmations CHECK (
    returned_at IS NULL OR (lost_confirmed_at IS NOT NULL AND found_confirmed_at IS NOT NULL)
  );

CREATE FUNCTION reset_stale_match_confirmations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.returned_at IS NULL AND
    (NEW.state = 'cancelled' OR (NEW.lost_revision, NEW.found_revision)
      IS DISTINCT FROM (OLD.lost_revision, OLD.found_revision)) THEN
    NEW.lost_confirmed_at := NULL;
    NEW.found_confirmed_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER match_confirmations_follow_revisions
  BEFORE UPDATE ON report_matches FOR EACH ROW EXECUTE FUNCTION reset_stale_match_confirmations();

ALTER TABLE notifications
  ADD COLUMN match_id INTEGER REFERENCES report_matches(match_id) ON DELETE RESTRICT,
  DROP CONSTRAINT notifications_kind_check,
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'PROFILE_UPDATED', 'AVATAR_UPDATED', 'MATCH_SUGGESTED', 'MATCH_PARTNER_CONFIRMED', 'MATCH_RETURNED'
  )),
  ADD CONSTRAINT notifications_match_valid CHECK (
    (match_id IS NULL AND kind IN ('PROFILE_UPDATED', 'AVATAR_UPDATED', 'MATCH_SUGGESTED'))
    OR (match_id IS NOT NULL AND kind IN ('MATCH_SUGGESTED', 'MATCH_PARTNER_CONFIRMED', 'MATCH_RETURNED'))
  );
CREATE INDEX notifications_match_idx ON notifications (match_id) WHERE match_id IS NOT NULL;
