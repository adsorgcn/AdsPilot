-- Siterank analysis history table
-- Stores historical scoring results for audit and trend analysis

CREATE TABLE IF NOT EXISTS "SiterankHistory" (
  analysis_id TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  offer_id    TEXT NOT NULL,
  score       INTEGER NOT NULL,
  result      JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_siterank_history_offer ON "SiterankHistory"(offer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_siterank_history_user ON "SiterankHistory"(user_id, created_at DESC);
