-- Core read models (minimum set for MVP)

CREATE TABLE IF NOT EXISTS "User" (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Offer" (
  id           TEXT PRIMARY KEY,
  userId       TEXT NOT NULL,
  originalUrl  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'opportunity',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_offer_user ON "Offer"(userId);

CREATE TABLE IF NOT EXISTS "SiterankAnalysis" (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  offer_id   TEXT NOT NULL,
  status     TEXT NOT NULL,
  result     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(offer_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_siterank_offer_user ON "SiterankAnalysis"(offer_id, user_id);

