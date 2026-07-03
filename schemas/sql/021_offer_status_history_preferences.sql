-- Offer Status History and Preferences tables

CREATE TABLE IF NOT EXISTS "OfferStatusHistory"(
    id BIGSERIAL PRIMARY KEY,
    offer_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offer_status_history_offer_id
    ON "OfferStatusHistory"(offer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS "OfferPreferences"(
    user_id TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    auto_status_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    zero_perf_days INTEGER NOT NULL DEFAULT 5,
    rosc_decline_days INTEGER NOT NULL DEFAULT 7,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, offer_id)
);
