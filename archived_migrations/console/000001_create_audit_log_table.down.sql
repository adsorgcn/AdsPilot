-- Down Migration: Drop audit_log table and related indexes
-- Description: Remove audit_log table and all its indexes

-- Drop the audit_log table (automatically drops indexes)
DROP TABLE IF EXISTS console.audit_log CASCADE;
