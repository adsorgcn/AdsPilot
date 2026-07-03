-- Add demo data support fields to Offers and related tables
-- Created: 2025-01-30

-- 1. Add is_demo and demo_category to offers table
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS demo_category VARCHAR(50);

-- Create compound index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_offers_user_demo ON offers(user_id, is_demo);

-- 2. Add is_demo to offer_evaluations table
ALTER TABLE offer_evaluations
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_offer_evaluations_user_demo ON offer_evaluations(offer_id, is_demo);

-- 3. Add is_demo to offer_revenues table
ALTER TABLE offer_revenues
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- 4. Add comments
COMMENT ON COLUMN offers.is_demo IS '是否为模拟数据（用于新用户演示）';
COMMENT ON COLUMN offers.demo_category IS '模拟数据分类：success, pending, failed, archived';
COMMENT ON COLUMN offer_evaluations.is_demo IS '是否为模拟数据';
COMMENT ON COLUMN offer_revenues.is_demo IS '是否为模拟数据';
