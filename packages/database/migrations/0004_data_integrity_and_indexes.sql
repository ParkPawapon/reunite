-- Preserve the five business entities. No new table or lifecycle/approval rule.
-- Block concurrent writes while inspecting and upgrading existing rows atomically.
LOCK TABLE users, categories, locations, item_reports, claims IN SHARE ROW EXCLUSIVE MODE;

-- Match JavaScript String.trim() whitespace, independent of the database locale.
CREATE FUNCTION trim_boundary_whitespace(value TEXT)
RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

-- Never merge accounts, delete invalid rows, or choose an owner on collision.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users
    GROUP BY lower(trim_boundary_whitespace(email)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505',
      MESSAGE = 'Email normalization conflicts: resolve duplicate accounts before applying migration 0004';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE trim_boundary_whitespace(name) = '' OR trim_boundary_whitespace(email) = '')
     OR EXISTS (SELECT 1 FROM categories WHERE trim_boundary_whitespace(category_name) = '')
     OR EXISTS (SELECT 1 FROM locations WHERE trim_boundary_whitespace(location_name) = '')
     OR EXISTS (SELECT 1 FROM item_reports WHERE trim_boundary_whitespace(title) = '')
     OR EXISTS (SELECT 1 FROM claims WHERE trim_boundary_whitespace(evidence) = '') THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Blank required text exists: correct source records before applying migration 0004';
  END IF;
END;
$$;

ALTER TABLE users
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE item_reports
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE claims ADD COLUMN updated_at TIMESTAMPTZ;
-- claim_date is already the known creation instant; never substitute event time.
UPDATE claims SET updated_at = claim_date;
ALTER TABLE claims
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN updated_at SET NOT NULL;

UPDATE users SET email = lower(trim_boundary_whitespace(email))
WHERE email IS DISTINCT FROM lower(trim_boundary_whitespace(email));

ALTER TABLE users
  ADD CONSTRAINT users_name_nonblank CHECK (trim_boundary_whitespace(name) <> ''),
  ADD CONSTRAINT users_email_canonical CHECK (email <> '' AND email = lower(trim_boundary_whitespace(email)));
ALTER TABLE categories
  ADD CONSTRAINT categories_name_nonblank CHECK (trim_boundary_whitespace(category_name) <> '');
ALTER TABLE locations
  ADD CONSTRAINT locations_name_nonblank CHECK (trim_boundary_whitespace(location_name) <> '');
ALTER TABLE item_reports
  ADD CONSTRAINT item_reports_title_nonblank CHECK (trim_boundary_whitespace(title) <> '');
ALTER TABLE claims
  ADD CONSTRAINT claims_evidence_nonblank CHECK (trim_boundary_whitespace(evidence) <> '');

CREATE FUNCTION normalize_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'));
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_normalize_email
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION normalize_user_email();

-- Canonical storage plus the existing UNIQUE(email) is case-insensitive uniqueness
-- without adding a redundant second unique index on lower(email).
COMMENT ON CONSTRAINT users_email_key ON users IS
  'Unique canonical lowercase, boundary-trimmed email; normalized on every INSERT/UPDATE.';

CREATE FUNCTION set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER item_reports_touch_updated_at BEFORE UPDATE ON item_reports
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER claims_touch_updated_at BEFORE UPDATE ON claims
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

COMMENT ON COLUMN users.created_at IS
  'Creation time for new users; pre-0004 records are backfilled with the migration instant (historical creation unknown).';
COMMENT ON COLUMN item_reports.created_at IS
  'Report submission time for new rows; pre-0004 records use the migration instant, never event_datetime.';
COMMENT ON COLUMN claims.updated_at IS
  'Last database UPDATE time; existing rows initialize from claim_date.';

-- Match existing WHERE + ORDER BY queries. Leftmost columns retain FK/filter use.
CREATE INDEX claims_user_claim_idx ON claims (user_id, claim_id DESC);
DROP INDEX claims_user_idx;
CREATE INDEX item_reports_type_status_report_idx ON item_reports (type, status, report_id DESC);
DROP INDEX item_reports_type_idx;

-- Keep non-cascading business FK behavior explicit and auditable.
COMMENT ON CONSTRAINT item_reports_user_id_fkey ON item_reports IS 'ON DELETE NO ACTION: preserve reports; no automatic business-data deletion.';
COMMENT ON CONSTRAINT item_reports_category_id_fkey ON item_reports IS 'ON DELETE NO ACTION: referenced catalog rows cannot be removed.';
COMMENT ON CONSTRAINT item_reports_location_id_fkey ON item_reports IS 'ON DELETE NO ACTION: referenced locations cannot be removed.';
COMMENT ON CONSTRAINT claims_user_id_fkey ON claims IS 'ON DELETE NO ACTION: preserve claim evidence; retention/anonymization requires an approved policy.';
COMMENT ON CONSTRAINT claims_report_id_fkey ON claims IS 'ON DELETE NO ACTION: reports with claims cannot be removed implicitly.';
