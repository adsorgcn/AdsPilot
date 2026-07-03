-- Migration: Referral and Trial Subscription System (Billing Service)
-- Date: 2025-10-15
-- Tasks: BE-052, BE-053, BE-054

-- Table 1: referrals
-- Purpose: Track referral invitations with trial subscription rewards
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL,
    referral_code VARCHAR(20) NOT NULL UNIQUE,

    -- Referee information
    referee_user_id UUID,
    referee_email VARCHAR(255),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, registered

    -- Rewards (trial subscriptions)
    inviter_trial_granted BOOLEAN DEFAULT false,
    referee_trial_granted BOOLEAN DEFAULT false,
    inviter_trial_days INTEGER DEFAULT 14,
    referee_trial_days INTEGER DEFAULT 14,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    registered_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- RLS policy
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_own_referrals ON referrals;
CREATE POLICY user_own_referrals ON referrals
    FOR ALL USING (referrer_user_id = current_setting('app.user_id')::uuid);

-- Table 2: trial_subscriptions
-- Purpose: Manage trial subscription periods and rewards
CREATE TABLE IF NOT EXISTS trial_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Plan information
    plan VARCHAR(20) NOT NULL DEFAULT 'professional', -- Fixed to 'professional'

    -- Duration
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, expired

    -- Source
    source VARCHAR(50) NOT NULL, -- self_register, referral_inviter, referral_referee
    referral_id UUID, -- Related referral record if source is referral

    -- Token reward
    tokens_granted INTEGER NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    expired_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trial_subscriptions_user_status ON trial_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trial_subscriptions_end_date ON trial_subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_trial_subscriptions_source ON trial_subscriptions(source);

-- RLS policy
ALTER TABLE trial_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_own_trials ON trial_subscriptions;
CREATE POLICY user_own_trials ON trial_subscriptions
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
