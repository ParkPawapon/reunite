-- Shared fixed-window account throttling, independent of any untrusted proxy/IP headers.
CREATE TABLE auth_login_throttles (
  key_hash CHAR(64) PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL CHECK (attempts > 0)
);
CREATE INDEX auth_login_throttles_window_idx ON auth_login_throttles (window_start);
