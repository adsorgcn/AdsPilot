-- Migration: Checkin System (Billing Service)
-- Date: 2025-10-15
-- Tasks: BE-044, BE-045, BE-046

-- Table 1: checkins
-- Purpose: Daily checkin records with fixed 10 tokens reward
CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Checkin info
    checkin_date DATE NOT NULL,
    tokens_earned INTEGER NOT NULL DEFAULT 10, -- Fixed 10 tokens

    created_at TIMESTAMP DEFAULT NOW(),

    -- Constraint: One checkin per user per day
    UNIQUE (user_id, checkin_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date DESC);

-- RLS policy
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_own_checkins ON checkins;
CREATE POLICY user_own_checkins ON checkins
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);

-- Table 2: user_checkin_stats
-- Purpose: Cached checkin statistics for performance
CREATE TABLE IF NOT EXISTS user_checkin_stats (
    user_id UUID PRIMARY KEY,

    -- Statistics
    total_checkins INTEGER DEFAULT 0,
    total_tokens_earned INTEGER DEFAULT 0, -- Should equal total_checkins * 10
    this_month_checkins INTEGER DEFAULT 0,

    -- Last checkin
    last_checkin_date DATE,

    updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS policy
ALTER TABLE user_checkin_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_own_stats ON user_checkin_stats;
CREATE POLICY user_own_stats ON user_checkin_stats
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
