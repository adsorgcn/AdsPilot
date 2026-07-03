-- Offer to Ads Account mapping and daily KPI tables

-- Mapping between an Offer and one or more Google Ads accounts
CREATE TABLE IF NOT EXISTS "OfferAccountMap" (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  offer_id    TEXT NOT NULL,
  account_id  TEXT NOT NULL,  -- Google Ads customer ID (string form)
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(offer_id, account_id)
);
CREATE INDEX IF NOT EXISTS ix_offer_account_user ON "OfferAccountMap"(user_id);
CREATE INDEX IF NOT EXISTS ix_offer_account_offer ON "OfferAccountMap"(offer_id);

-- Daily KPI aggregated per offer
CREATE TABLE IF NOT EXISTS "OfferDailyKPI" (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL,
  offer_id     TEXT NOT NULL,
  date         DATE NOT NULL,
  impressions  BIGINT NOT NULL DEFAULT 0,
  clicks       BIGINT NOT NULL DEFAULT 0,
  spend        NUMERIC(16,4) NOT NULL DEFAULT 0,
  revenue      NUMERIC(16,4) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, offer_id, date)
);
CREATE INDEX IF NOT EXISTS ix_offer_kpi_offer_date ON "OfferDailyKPI"(offer_id, date);
CREATE INDEX IF NOT EXISTS ix_offer_kpi_user_offer ON "OfferDailyKPI"(user_id, offer_id);

