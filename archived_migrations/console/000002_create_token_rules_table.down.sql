-- Migration: Drop token_consumption_rules table and related objects
-- Description: Remove token_consumption_rules table, indexes, and triggers

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_update_token_rules_updated_at ON console.token_consumption_rules;

-- Drop the function
DROP FUNCTION IF EXISTS console.update_token_rules_updated_at();

-- Drop the table (automatically drops indexes)
DROP TABLE IF EXISTS console.token_consumption_rules;