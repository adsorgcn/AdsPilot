-- Migration: Drop console service read-only views
-- Description: Remove all views created for console dashboard queries

-- Drop the views
DROP VIEW IF EXISTS console.console_user_overview;
DROP VIEW IF EXISTS console.console_dashboard_summary;
DROP VIEW IF EXISTS console.console_subscriptions_with_users;