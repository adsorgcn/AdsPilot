-- Dead Letter Queue for Offer KPI aggregation failures

CREATE TABLE IF NOT EXISTS "OfferKpiDeadLetter" (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL,
  offer_id     TEXT NOT NULL,
  date         DATE NOT NULL,
  reason       TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count  INT  NOT NULL DEFAULT 0,
  last_error   TEXT,
  status       TEXT NOT NULL DEFAULT 'queued', -- queued|dead|resolved
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_offer_kpi_dlq_user ON "OfferKpiDeadLetter"(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_offer_kpi_dlq_offer ON "OfferKpiDeadLetter"(offer_id, date);

