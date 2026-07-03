-- Referral program schema and user enrichment

-- 1. Referral code table
CREATE TABLE IF NOT EXISTS "UserReferralCode" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_invites INTEGER NOT NULL DEFAULT 0,
    successful_invites INTEGER NOT NULL DEFAULT 0,
    total_rewards_days INTEGER NOT NULL DEFAULT 0
);

-- 2. Referral record table
CREATE TABLE IF NOT EXISTS "ReferralRecord" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    referee_reward_days INTEGER NOT NULL DEFAULT 30,
    referrer_reward_days INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(referee_id)
);

-- 3. Supporting indexes
CREATE INDEX IF NOT EXISTS idx_referral_code_user ON "UserReferralCode"(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_code_code ON "UserReferralCode"(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_record_referrer ON "ReferralRecord"(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_record_status ON "ReferralRecord"(status);

-- 4. Enable Row Level Security
ALTER TABLE "UserReferralCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferralRecord" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE polname = 'user_referral_code_select' AND tablename = 'UserReferralCode'
    ) THEN
        CREATE POLICY user_referral_code_select
            ON "UserReferralCode"
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE polname = 'user_referral_records_select' AND tablename = 'ReferralRecord'
    ) THEN
        CREATE POLICY user_referral_records_select
            ON "ReferralRecord"
            FOR SELECT
            USING (auth.uid() = referrer_id);
    END IF;
END $$;

-- 5. Extend User table with subscription and referral fields
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES "User"(id),
    ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_checkin_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_checkin_date DATE,
    ADD COLUMN IF NOT EXISTS total_checkin_days INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_subscription_tier ON "User"(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_referred_by ON "User"(referred_by);
CREATE INDEX IF NOT EXISTS idx_user_token_balance ON "User"(token_balance);
