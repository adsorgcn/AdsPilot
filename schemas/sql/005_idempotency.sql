-- Simple idempotency key registry (service-agnostic)
-- Enforces one action per key per user+scope within TTL

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  scope      TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_idem_expires ON idempotency_keys(expires_at);

