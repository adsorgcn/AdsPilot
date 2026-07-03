-- Notifications read models (initial)

CREATE TABLE IF NOT EXISTS user_notifications (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time ON user_notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_rules (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  channel      TEXT        NOT NULL DEFAULT 'inapp',
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notification_rules_user ON notification_rules(user_id);

