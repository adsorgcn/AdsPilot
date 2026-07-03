-- Rollback: Complete Offer Setup

-- Drop comments
COMMENT ON TABLE offer_evaluations IS NULL;
COMMENT ON TABLE offer_revenues IS NULL;
COMMENT ON COLUMN offers.roas IS NULL;
COMMENT ON COLUMN offers.ad_spend IS NULL;
COMMENT ON COLUMN offers.total_revenue IS NULL;
COMMENT ON COLUMN offers.domain IS NULL;
COMMENT ON COLUMN offers.final_url_suffix IS NULL;
COMMENT ON COLUMN offers.final_url IS NULL;
COMMENT ON COLUMN offers.launch_status IS NULL;
COMMENT ON COLUMN offers.simulation_status IS NULL;
COMMENT ON COLUMN offers.evaluation_status IS NULL;
COMMENT ON COLUMN offers.target_countries IS NULL;

-- Drop performance indexes
DROP INDEX IF EXISTS idx_offers_siterank_score;
DROP INDEX IF EXISTS idx_offers_roas;
DROP INDEX IF EXISTS idx_offers_domain;
DROP INDEX IF EXISTS idx_offers_evaluation_status;
DROP INDEX IF EXISTS idx_offers_user_id_status;

-- Drop triggers
DROP TRIGGER IF EXISTS update_offer_evaluations_updated_at ON offer_evaluations;
DROP TRIGGER IF EXISTS update_offer_revenues_updated_at ON offer_revenues;
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop evaluation table indexes
DROP INDEX IF EXISTS idx_offer_evaluations_created_at;
DROP INDEX IF EXISTS idx_offer_evaluations_status;
DROP INDEX IF EXISTS idx_offer_evaluations_offer_id;

-- Drop evaluation table
DROP TABLE IF EXISTS offer_evaluations;

-- Drop revenue table indexes
DROP INDEX IF EXISTS idx_offer_revenues_created_at;
DROP INDEX IF EXISTS idx_offer_revenues_offer_id;

-- Drop revenue table
DROP TABLE IF EXISTS offer_revenues;

-- Remove enhancement columns from offers
ALTER TABLE offers
DROP COLUMN IF EXISTS updated_at,
DROP COLUMN IF EXISTS roas,
DROP COLUMN IF EXISTS ad_spend,
DROP COLUMN IF EXISTS total_revenue,
DROP COLUMN IF EXISTS avg_cpc,
DROP COLUMN IF EXISTS ctr,
DROP COLUMN IF EXISTS clicks,
DROP COLUMN IF EXISTS impressions,
DROP COLUMN IF EXISTS domain,
DROP COLUMN IF EXISTS final_url_suffix,
DROP COLUMN IF EXISTS final_url,
DROP COLUMN IF EXISTS launch_status,
DROP COLUMN IF EXISTS simulation_status,
DROP COLUMN IF EXISTS evaluation_status,
DROP COLUMN IF EXISTS target_countries;

-- Drop base table indexes
DROP INDEX IF EXISTS idx_offers_created_at;
DROP INDEX IF EXISTS idx_offers_user_id;

-- Drop base offers table
DROP TABLE IF EXISTS offers;
