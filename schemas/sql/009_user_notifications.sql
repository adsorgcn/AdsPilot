-- Notifications read model table for in-app notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time ON user_notifications(user_id, id DESC);

