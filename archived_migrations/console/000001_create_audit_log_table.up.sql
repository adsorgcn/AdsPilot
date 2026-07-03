-- Migration: Create audit_log table for admin operations tracking
-- Date: 2025-10-07
-- Description: Add audit_log table to track all administrative operations

-- Create console schema if not exists
CREATE SCHEMA IF NOT EXISTS console;

-- Create audit_log table
CREATE TABLE IF NOT EXISTS console.audit_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    "resourceId" TEXT,
    method TEXT NOT NULL, -- GET, POST, PUT, DELETE
    path TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    metadata JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Add comment
    CONSTRAINT audit_log_action_check CHECK (action IN (
        'user.create', 'user.update', 'user.delete', 'user.archive',
        'plan.create', 'plan.update', 'plan.delete',
        'token.topup', 'token.rule.create', 'token.rule.update', 'token.rule.delete',
        'apikey.create', 'apikey.update', 'apikey.delete', 'apikey.revoke',
        'config.update', 'config.delete',
        'offer.bulk.archive', 'offer.bulk.status',
        'other'
    ))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON console.audit_log("userId");
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON console.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON console.audit_log(resource);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON console.audit_log("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action ON console.audit_log("userId", action);

-- Composite index for time-based user queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
    ON console.audit_log("userId", "createdAt" DESC);

-- Add comments
COMMENT ON TABLE console.audit_log IS 'Audit log for all administrative operations';
COMMENT ON COLUMN console.audit_log."userId" IS 'Admin user ID who performed the action';
COMMENT ON COLUMN console.audit_log.action IS 'Action type (e.g., user.create, plan.update)';
COMMENT ON COLUMN console.audit_log.resource IS 'Resource type (e.g., user, plan, token)';
COMMENT ON COLUMN console.audit_log."resourceId" IS 'ID of the affected resource';
COMMENT ON COLUMN console.audit_log."requestBody" IS 'Request body JSON (sensitive data filtered)';
COMMENT ON COLUMN console.audit_log."responseBody" IS 'Response body JSON (truncated if large)';
COMMENT ON COLUMN console.audit_log.metadata IS 'Additional metadata (e.g., reason, changedFields)';