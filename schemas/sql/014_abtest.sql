-- AB Test minimal read model tables
-- ABTest: core record
CREATE TABLE IF NOT EXISTS "ABTest" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  seed_ad_group_id TEXT NOT NULL,
  variant_a_group_id TEXT,
  variant_b_group_id TEXT,
  split_a INT NOT NULL DEFAULT 50,
  split_b INT NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'planned', -- planned|running|completed|canceled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_abtest_user ON "ABTest"(user_id, created_at DESC);

-- Aggregated metrics per variant (simple MVP)
CREATE TABLE IF NOT EXISTS "ABTestMetric" (
  id BIGSERIAL PRIMARY KEY,
  test_id TEXT NOT NULL,
  variant CHAR(1) NOT NULL, -- 'A' or 'B'
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  cost_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_abtest_metric_test ON "ABTestMetric"(test_id, variant);

