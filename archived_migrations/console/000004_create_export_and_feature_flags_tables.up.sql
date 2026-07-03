-- Migration: Create export_history and feature_flags tables
-- Date: 2025-10-15
-- Description: Tables for Export Center and Feature Flags functionality

-- Create console schema if not exists
CREATE SCHEMA IF NOT EXISTS console;

-- Export History Table
CREATE TABLE IF NOT EXISTS console.export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by TEXT NOT NULL,
    type TEXT NOT NULL,
    format TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    start_date DATE,
    end_date DATE,
    record_count INTEGER DEFAULT 0,
    file_url TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Export History Indexes
CREATE INDEX IF NOT EXISTS idx_export_history_created_by ON console.export_history(created_by);
CREATE INDEX IF NOT EXISTS idx_export_history_status ON console.export_history(status);
CREATE INDEX IF NOT EXISTS idx_export_history_type ON console.export_history(type);
CREATE INDEX IF NOT EXISTS idx_export_history_created_at ON console.export_history(created_at DESC);

-- Feature Flags Table
CREATE TABLE IF NOT EXISTS console.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Flag History Table
CREATE TABLE IF NOT EXISTS console.feature_flag_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key TEXT NOT NULL,
    old_value BOOLEAN NOT NULL,
    new_value BOOLEAN NOT NULL,
    changed_by TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (flag_key) REFERENCES console.feature_flags(key) ON DELETE CASCADE
);

-- Feature Flags Indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON console.feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON console.feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flag_history_flag_key ON console.feature_flag_history(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flag_history_created_at ON console.feature_flag_history(created_at DESC);

-- Notification Templates Table (referenced in cleanup)
CREATE TABLE IF NOT EXISTS console.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    type TEXT CHECK (type IN ('email', 'in_app', 'webhook')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Broadcasts Table (referenced in cleanup)
CREATE TABLE IF NOT EXISTS console.notification_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_audience TEXT CHECK (target_audience IN ('all', 'admins', 'users')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
    created_by TEXT,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NPS Feedback Table (referenced in cleanup)
CREATE TABLE IF NOT EXISTS console.nps_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE console.export_history IS 'Export history tracking for various data exports';
COMMENT ON TABLE console.feature_flags IS 'Feature flags for gradual feature rollout';
COMMENT ON TABLE console.feature_flag_history IS 'Audit trail for feature flag changes';
COMMENT ON TABLE console.notification_templates IS 'Templates for system notifications';
COMMENT ON TABLE console.notification_broadcasts IS 'Broadcast notifications to users';
COMMENT ON TABLE console.nps_feedback IS 'Net Promoter Score feedback from users';