-- One durable pair queue/result table; the database now has ten physical tables.
ALTER TABLE item_reports
  ADD COLUMN matching_revision BIGINT NOT NULL DEFAULT 1 CHECK (matching_revision > 0),
  ADD COLUMN image_data BYTEA,
  ADD CONSTRAINT report_image_size CHECK (image_data IS NULL OR octet_length(image_data) <= 1048576);

CREATE TABLE report_matches (
  match_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lost_report_id INTEGER NOT NULL REFERENCES item_reports(report_id) ON DELETE RESTRICT,
  found_report_id INTEGER NOT NULL REFERENCES item_reports(report_id) ON DELETE RESTRICT,
  lost_revision BIGINT NOT NULL,
  found_revision BIGINT NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','processing','complete','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token UUID,
  leased_until TIMESTAMPTZ,
  reserved_usd_micros BIGINT NOT NULL DEFAULT 0 CHECK (reserved_usd_micros >= 0),
  estimated_usd_micros BIGINT NOT NULL DEFAULT 0 CHECK (estimated_usd_micros >= 0),
  result JSONB,
  model VARCHAR(80),
  provider_response_id VARCHAR(160),
  error_code VARCHAR(40),
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (lost_report_id, found_report_id),
  CHECK (lost_report_id <> found_report_id),
  CHECK ((state = 'processing' AND lease_token IS NOT NULL AND leased_until IS NOT NULL)
      OR (state <> 'processing' AND lease_token IS NULL AND leased_until IS NULL)),
  CHECK (state <> 'complete' OR (result IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX report_matches_queue_idx ON report_matches (available_at, match_id)
  WHERE state IN ('queued','processing');
CREATE INDEX report_matches_found_idx ON report_matches (found_report_id, match_id DESC);

CREATE FUNCTION bump_report_matching_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.title,NEW.description,NEW.category_id,NEW.location_id,NEW.type,NEW.status,
      NEW.event_datetime,NEW.image,NEW.image_data,NEW.user_id)
    IS DISTINCT FROM
     (OLD.title,OLD.description,OLD.category_id,OLD.location_id,OLD.type,OLD.status,
      OLD.event_datetime,OLD.image,OLD.image_data,OLD.user_id) THEN
    NEW.matching_revision := OLD.matching_revision + 1;
  ELSE
    NEW.matching_revision := OLD.matching_revision;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER report_matching_revision BEFORE UPDATE ON item_reports
  FOR EACH ROW EXECUTE FUNCTION bump_report_matching_revision();

CREATE FUNCTION queue_report_matching() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.matching_revision = OLD.matching_revision THEN
    RETURN NEW;
  END IF;
  UPDATE report_matches SET state='cancelled', lease_token=NULL, leased_until=NULL,
    result=NULL, completed_at=NULL
    WHERE lost_report_id=NEW.report_id OR found_report_id=NEW.report_id;
  IF NEW.status = 'OPEN' THEN
    INSERT INTO report_matches(lost_report_id,found_report_id,lost_revision,found_revision)
      SELECT CASE WHEN NEW.type='LOST' THEN NEW.report_id ELSE peer.report_id END,
             CASE WHEN NEW.type='FOUND' THEN NEW.report_id ELSE peer.report_id END,
             CASE WHEN NEW.type='LOST' THEN NEW.matching_revision ELSE peer.matching_revision END,
             CASE WHEN NEW.type='FOUND' THEN NEW.matching_revision ELSE peer.matching_revision END
      FROM item_reports peer WHERE peer.status='OPEN' AND peer.type<>NEW.type AND peer.user_id<>NEW.user_id
      ORDER BY peer.report_id
    ON CONFLICT (lost_report_id,found_report_id) DO UPDATE SET
      lost_revision=EXCLUDED.lost_revision, found_revision=EXCLUDED.found_revision,
      state='queued',attempts=0,available_at=CURRENT_TIMESTAMP,lease_token=NULL,leased_until=NULL,
      result=NULL,model=NULL,provider_response_id=NULL,error_code=NULL,completed_at=NULL
    WHERE report_matches.lost_revision<=EXCLUDED.lost_revision
      AND report_matches.found_revision<=EXCLUDED.found_revision;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER report_matching_queue AFTER INSERT OR UPDATE ON item_reports
  FOR EACH ROW EXECUTE FUNCTION queue_report_matching();

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('PROFILE_UPDATED','AVATAR_UPDATED','MATCH_SUGGESTED'));
