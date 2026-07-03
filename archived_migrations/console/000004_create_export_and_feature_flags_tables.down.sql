-- Migration: Drop export, feature flags, and notification tables
-- Description: Remove all tables created in the up migration

-- Drop tables in correct order to handle foreign key constraints
DROP TABLE IF EXISTS console.nps_feedback;
DROP TABLE IF EXISTS console.notification_broadcasts;
DROP TABLE IF EXISTS console.notification_templates;
DROP TABLE IF EXISTS console.feature_flag_history;
DROP TABLE IF EXISTS console.feature_flags;
DROP TABLE IF EXISTS console.export_history;