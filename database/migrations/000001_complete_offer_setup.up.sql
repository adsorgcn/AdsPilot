-- Complete Offer Setup: Create base table + enhancements
-- Created: 2025-01-30

-- 1. Create base offers table if not exists
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    original_url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'evaluating' CHECK (status IN ('evaluating', 'optimizing', 'scaling', 'archived')),
    siterank_score DECIMAL(5,2) CHECK (siterank_score >= 0 AND siterank_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for base table
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON offers(created_at DESC);

-- 2. Add enhancement columns
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT ARRAY['US'],
ADD COLUMN IF NOT EXISTS evaluation_status VARCHAR(50) DEFAULT 'not_evaluated',
ADD COLUMN IF NOT EXISTS simulation_status VARCHAR(50) DEFAULT 'not_simulated',
ADD COLUMN IF NOT EXISTS launch_status VARCHAR(50) DEFAULT 'not_launched',
ADD COLUMN IF NOT EXISTS final_url TEXT,
ADD COLUMN IF NOT EXISTS final_url_suffix TEXT,
ADD COLUMN IF NOT EXISTS domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS impressions BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS ctr DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_cpc DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ad_spend DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS roas DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Create revenue records table
CREATE TABLE IF NOT EXISTS offer_revenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_revenues_offer_id ON offer_revenues(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_revenues_created_at ON offer_revenues(created_at DESC);

-- 4. Create evaluation results table
CREATE TABLE IF NOT EXISTS offer_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'evaluating', 'completed', 'failed')),
    score DECIMAL(5,2) CHECK (score >= 0 AND score <= 100),
    brand_name VARCHAR(255),
    final_url TEXT,
    final_url_suffix TEXT,
    domain VARCHAR(255),
    similarweb_data JSONB,
    redirect_chain JSONB,
    insights JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_evaluations_offer_id ON offer_evaluations(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_status ON offer_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_created_at ON offer_evaluations(created_at DESC);

-- 5. Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offer_revenues_updated_at ON offer_revenues;
CREATE TRIGGER update_offer_revenues_updated_at
    BEFORE UPDATE ON offer_revenues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offer_evaluations_updated_at ON offer_evaluations;
CREATE TRIGGER update_offer_evaluations_updated_at
    BEFORE UPDATE ON offer_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_offers_user_id_status ON offers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_offers_evaluation_status ON offers(evaluation_status);
CREATE INDEX IF NOT EXISTS idx_offers_domain ON offers(domain);
CREATE INDEX IF NOT EXISTS idx_offers_roas ON offers(roas DESC) WHERE roas > 0;
CREATE INDEX IF NOT EXISTS idx_offers_siterank_score ON offers(siterank_score DESC) WHERE siterank_score IS NOT NULL;

-- 7. Add table comments
COMMENT ON COLUMN offers.target_countries IS '投放国家列表';
COMMENT ON COLUMN offers.evaluation_status IS '评估状态: not_evaluated, evaluating, evaluated, failed';
COMMENT ON COLUMN offers.simulation_status IS '仿真状态: not_simulated, simulating, simulated, failed';
COMMENT ON COLUMN offers.launch_status IS '投放状态: not_launched, launching, launched, paused';
COMMENT ON COLUMN offers.final_url IS '最终落地页URL';
COMMENT ON COLUMN offers.final_url_suffix IS 'URL参数后缀';
COMMENT ON COLUMN offers.domain IS '域名';
COMMENT ON COLUMN offers.total_revenue IS '总收入';
COMMENT ON COLUMN offers.ad_spend IS '广告支出';
COMMENT ON COLUMN offers.roas IS '广告支出回报率 (Return on Ad Spend)';

COMMENT ON TABLE offer_revenues IS 'Offer收入记录表';
COMMENT ON TABLE offer_evaluations IS 'Offer评估结果表';
