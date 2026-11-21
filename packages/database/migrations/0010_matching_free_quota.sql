ALTER TABLE report_matches
  ADD COLUMN free_quota_day date,
  ADD COLUMN free_attempts_today smallint NOT NULL DEFAULT 0,
  ADD CONSTRAINT match_free_quota_consistent CHECK (
    (free_quota_day IS NULL AND free_attempts_today = 0)
    OR (free_quota_day IS NOT NULL AND free_attempts_today BETWEEN 1 AND 10)
  );

CREATE INDEX report_matches_free_quota_day_idx ON report_matches (free_quota_day)
  INCLUDE (free_attempts_today) WHERE free_quota_day IS NOT NULL;
