-- Fix useractivity service database tables in Cloud SQL
-- This script creates the required tables for useractivity service

-- User notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time ON user_notifications(user_id, id DESC);

-- User notification state table
CREATE TABLE IF NOT EXISTS user_notification_state (
    user_id TEXT PRIMARY KEY,
    last_read_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check-in system tables
CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "lastCheckinAt" TIMESTAMPTZ,
    "totalCheckins" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "tokensEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_checkins_userId ON checkins("userId");

CREATE TABLE IF NOT EXISTS user_checkin_stats (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "checkinDate" DATE NOT NULL,
    "tokensEarned" INTEGER NOT NULL DEFAULT 0,
    "streakDay" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("userId", "checkinDate")
);

CREATE INDEX IF NOT EXISTS ix_user_checkin_stats_userId ON user_checkin_stats("userId", "checkinDate" DESC);

-- Referral system tables
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    referralCode TEXT NOT NULL UNIQUE,
    totalReferrals INTEGER NOT NULL DEFAULT 0,
    successfulReferrals INTEGER NOT NULL DEFAULT 0,
    totalRewards INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_referrals_userId ON referrals("userId");
CREATE INDEX IF NOT EXISTS ix_referrals_code ON referrals("referralCode");

CREATE TABLE IF NOT EXISTS referral_records (
    id TEXT PRIMARY KEY,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    referralCode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    rewardAmount INTEGER NOT NULL DEFAULT 0,
    rewardGranted BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "completedAt" TIMESTAMPTZ,
    UNIQUE("inviteeId")
);

CREATE INDEX IF NOT EXISTS ix_referral_records_inviter ON referral_records("inviterId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS ix_referral_records_invitee ON referral_records("inviteeId");

-- Trial subscriptions table (if needed - may be deprecated)
CREATE TABLE IF NOT EXISTS trial_subscriptions (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    trialType TEXT NOT NULL,
    startDate TIMESTAMPTZ NOT NULL,
    endDate TIMESTAMPTZ NOT NULL,
    daysGranted INTEGER NOT NULL,
    source TEXT NOT NULL,
    referralId TEXT,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_trial_subscriptions_userId ON trial_subscriptions("userId", "endDate" DESC);
CREATE INDEX IF NOT EXISTS ix_trial_subscriptions_active ON trial_subscriptions("isActive", "endDate");

-- Notification rules table
CREATE TABLE IF NOT EXISTS notification_rules (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'inapp',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, event_type, channel)
);

-- Event store table (shared across services)
CREATE TABLE IF NOT EXISTS event_store (
    id BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    event_name TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_event_store_aggregate ON event_store(aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_event_store_occurred_at ON event_store(occurred_at DESC);

-- Insert sample notification for testing
INSERT INTO user_notifications (user_id, type, title, message, created_at)
VALUES
    ('test-user-123', 'TEST', 'Welcome to Google-Monetize', 'Your account has been successfully created!', NOW()),
    ('test-user-123', 'INFO', 'System Update', 'New features have been added to the platform.', NOW())
ON CONFLICT DO NOTHING;

-- Insert sample check-in data for testing
INSERT INTO checkins (id, "userId", "lastCheckinAt", "totalCheckins", "currentStreak", "longestStreak", "tokensEarned", "createdAt", "updatedAt")
VALUES
    ('checkin-test-123', 'test-user-123', NOW(), 1, 1, 1, 10, NOW(), NOW())
ON CONFLICT ("userId") DO UPDATE SET
    "totalCheckins" = EXCLUDED."totalCheckins",
    "lastCheckinAt" = EXCLUDED."lastCheckinAt",
    "updatedAt" = NOW();