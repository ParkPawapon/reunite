-- In-app account activity only. No fabricated lost-item matching or approval events.
CREATE TABLE notifications (
  notification_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('PROFILE_UPDATED', 'AVATAR_UPDATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ,
  CONSTRAINT notifications_read_time_valid CHECK (read_at IS NULL OR read_at >= created_at)
);

CREATE INDEX notifications_user_recent_idx ON notifications (user_id, notification_id DESC);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, notification_id DESC) WHERE read_at IS NULL;
