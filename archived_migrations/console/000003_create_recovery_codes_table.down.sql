-- Migration: Drop recovery codes and audit log tables and related objects
-- Description: Remove admin_recovery_codes table, admin_audit_log table, views, and functions

-- Drop the view
DROP VIEW IF EXISTS console.critical_admin_actions;

-- Drop the function
DROP FUNCTION IF EXISTS console.cleanup_expired_recovery_codes();

-- Drop the admin_audit_log table (automatically drops indexes)
DROP TABLE IF EXISTS console.admin_audit_log;

-- Drop the admin_recovery_codes table (automatically drops indexes)
DROP TABLE IF EXISTS console.admin_recovery_codes;