CREATE TABLE users (
  user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20)
);

CREATE TABLE categories (
  category_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE locations (
  location_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location_name VARCHAR(150) NOT NULL,
  detail TEXT
);
CREATE INDEX locations_name_idx ON locations (location_name);

CREATE TABLE item_reports (
  report_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (user_id),
  category_id INTEGER NOT NULL REFERENCES categories (category_id),
  location_id INTEGER NOT NULL REFERENCES locations (location_id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('LOST', 'FOUND')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image VARCHAR(500),
  event_datetime TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CLOSED'))
);
CREATE INDEX item_reports_user_idx ON item_reports (user_id);
CREATE INDEX item_reports_category_idx ON item_reports (category_id);
CREATE INDEX item_reports_location_idx ON item_reports (location_id);
CREATE INDEX item_reports_type_idx ON item_reports (type);
CREATE INDEX item_reports_status_idx ON item_reports (status);
CREATE INDEX item_reports_event_idx ON item_reports (event_datetime);

CREATE TABLE claims (
  claim_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES item_reports (report_id),
  user_id INTEGER NOT NULL REFERENCES users (user_id),
  evidence TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  claim_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX claims_report_idx ON claims (report_id);
CREATE INDEX claims_user_idx ON claims (user_id);
CREATE INDEX claims_status_idx ON claims (status);
CREATE INDEX claims_date_idx ON claims (claim_date);
