-- Country-aware domain cache for external SimilarWeb data
-- Composite key (host + country) for country-specific metrics

CREATE TABLE IF NOT EXISTS domain_country_cache (
  host       TEXT NOT NULL,
  country    TEXT NOT NULL DEFAULT '',
  payload    JSONB NOT NULL,
  ok         BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (host, country)
);

CREATE INDEX IF NOT EXISTS ix_domain_country_cache_expires ON domain_country_cache(expires_at);
