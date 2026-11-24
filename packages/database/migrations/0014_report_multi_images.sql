ALTER TABLE item_reports
  ADD COLUMN image_data_2 BYTEA,
  ADD COLUMN image_data_3 BYTEA,
  ADD CONSTRAINT report_image_2_size CHECK (image_data_2 IS NULL OR octet_length(image_data_2) <= 1048576),
  ADD CONSTRAINT report_image_3_size CHECK (image_data_3 IS NULL OR octet_length(image_data_3) <= 1048576);

CREATE OR REPLACE FUNCTION bump_report_matching_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.title,NEW.description,NEW.category_id,NEW.location_id,NEW.type,NEW.status,
      NEW.event_datetime,NEW.image,NEW.image_data,NEW.image_data_2,NEW.image_data_3,NEW.user_id)
    IS DISTINCT FROM
     (OLD.title,OLD.description,OLD.category_id,OLD.location_id,OLD.type,OLD.status,
      OLD.event_datetime,OLD.image,OLD.image_data,OLD.image_data_2,OLD.image_data_3,OLD.user_id) THEN
    NEW.matching_revision := OLD.matching_revision + 1;
  ELSE
    NEW.matching_revision := OLD.matching_revision;
  END IF;
  RETURN NEW;
END $$;
