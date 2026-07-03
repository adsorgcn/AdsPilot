-- Migration: Offer Evaluation System (Siterank Service)
-- Date: 2025-10-15
-- Tasks: BE-001, BE-002, BE-003, BE-004, BE-005

-- Table 1: offer_evaluations (评估结果表)
-- Purpose: Store evaluation results per user, with RLS isolation
CREATE TABLE IF NOT EXISTS offer_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    offer_id UUID NOT NULL,
    offer_url_hash VARCHAR(64) NOT NULL,
    offer_url TEXT NOT NULL,

    -- Basic information
    final_landing_url TEXT,
    domain VARCHAR(255),
    brand_name VARCHAR(255),
    redirect_chain JSONB,

    -- SimilarWeb data
    similarweb_data JSONB,
    similarweb_cached BOOLEAN DEFAULT false,

    -- AI evaluation results (Pro/Elite only)
    ai_recommendation_score INTEGER,
    ai_recommendation_reasons JSONB,
    ai_evaluation_raw JSONB,

    -- Metadata
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    tokens_consumed INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for offer_evaluations
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_user_offer ON offer_evaluations(user_id, offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_url_hash ON offer_evaluations(offer_url_hash);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_status ON offer_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_created_at ON offer_evaluations(created_at DESC);

-- RLS for offer_evaluations
ALTER TABLE offer_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_own_evaluations ON offer_evaluations;
CREATE POLICY user_own_evaluations ON offer_evaluations
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);

-- Table 2: similarweb_global_cache (全局缓存表)
-- Purpose: Global cache for SimilarWeb data, no user isolation
CREATE TABLE IF NOT EXISTS similarweb_global_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    domain_hash VARCHAR(64) NOT NULL,

    -- Cache data
    similarweb_data JSONB NOT NULL,
    is_success BOOLEAN NOT NULL,

    -- Cache metadata
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for similarweb_global_cache
CREATE INDEX IF NOT EXISTS idx_similarweb_cache_domain ON similarweb_global_cache(domain);
CREATE INDEX IF NOT EXISTS idx_similarweb_cache_domain_hash ON similarweb_global_cache(domain_hash);
CREATE INDEX IF NOT EXISTS idx_similarweb_cache_expires_at ON similarweb_global_cache(expires_at);

-- No RLS for global cache (shared across all users)

-- Table 3: evaluation_aggregations (URL聚合数据)
-- Purpose: Aggregate evaluation data by URL hash for analytics
CREATE TABLE IF NOT EXISTS evaluation_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_url_hash VARCHAR(64) NOT NULL UNIQUE,
    offer_url TEXT NOT NULL,

    -- Aggregation stats
    total_evaluations INTEGER DEFAULT 0,
    last_evaluation_id UUID,
    last_evaluation_at TIMESTAMP,

    -- Latest data snapshot
    latest_domain VARCHAR(255),
    latest_brand VARCHAR(255),
    latest_similarweb_data JSONB,
    latest_ai_score INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for evaluation_aggregations
CREATE INDEX IF NOT EXISTS idx_evaluation_aggregations_url_hash ON evaluation_aggregations(offer_url_hash);
CREATE INDEX IF NOT EXISTS idx_evaluation_aggregations_updated_at ON evaluation_aggregations(updated_at DESC);

-- No RLS for aggregations (internal use)

-- Table 4: Modify offers table to add new columns
ALTER TABLE offers ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS brand_name_auto_filled BOOLEAN DEFAULT false;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS latest_evaluation_id UUID;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS latest_ai_score INTEGER;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMP;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_offers_brand_name ON offers(brand_name);
CREATE INDEX IF NOT EXISTS idx_offers_ai_score ON offers(latest_ai_score DESC);
