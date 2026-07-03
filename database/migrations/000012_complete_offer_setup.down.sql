-- Rollback: Complete Offer Setup
-- Renamed from: 20250130_complete_offer_setup.sql

-- Drop triggers
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
DROP TRIGGER IF EXISTS update_offer_revenues_updated_at ON offer_revenues;
DROP TRIGGER IF EXISTS update_offer_evaluations_updated_at ON offer_evaluations;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in correct order to handle foreign key constraints)
DROP TABLE IF EXISTS offer_evaluations;
DROP TABLE IF EXISTS offer_revenues;
DROP TABLE IF EXISTS offers;