-- Migration: Optimize Trial Subscription Indexes for Cumulative Referral Rewards
-- Date: 2025-10-18
-- Purpose: Add indexes to speed up trial history checks and active trial queries

-- Index for checking trial history by source (used by hasTrialHistoryBySource)
-- This speeds up checking if a user has received a referral_invitee reward
CREATE INDEX IF NOT EXISTS idx_subscription_user_source_trial
ON "Subscription"("userId", "trialSource", "trialStartDate")
WHERE "trialStartDate" IS NOT NULL;

-- Index for finding active trials (used by extendOrCreateTrial)
-- This speeds up queries to find a user's current active trial for extension
CREATE INDEX IF NOT EXISTS idx_subscription_user_status_trial_end
ON "Subscription"("userId", status, "trialEndDate")
WHERE status = 'active' AND "trialEndDate" > NOW();

-- Ensure trialSource field has values for existing records
-- Set to 'self_register' for any NULL or empty trialSource values
UPDATE "Subscription"
SET "trialSource" = 'self_register'
WHERE "trialStartDate" IS NOT NULL
  AND ("trialSource" IS NULL OR "trialSource" = '');
