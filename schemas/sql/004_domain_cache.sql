-- Global domain-level cache for external SimilarWeb data
-- No user-level isolation; key is host only

CREATE TABLE IF NOT EXISTS domain_cache (
  host       TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  ok         BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_domain_cache_expires ON domain_cache(expires_at);

