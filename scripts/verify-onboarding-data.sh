#!/bin/bash
set -e

# Verify onboarding system data in database
# Checks recent trial subscriptions and their associated onboarding data

echo "🔍 Verifying New User Onboarding System Data"
echo "=============================================="
echo ""

# Get DATABASE_URL from secret
DATABASE_URL=$(gcloud secrets versions access latest --secret="DATABASE_URL" 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Could not retrieve DATABASE_URL from secrets"
  echo "   Run: gcloud secrets versions access latest --secret=\"DATABASE_URL\""
  exit 1
fi

echo "📊 Checking recent trial subscriptions and onboarding data..."
echo ""

# Query recent trial subscriptions and check for associated onboarding data
psql "$DATABASE_URL" <<'SQL'
\x auto

-- Recent trial subscriptions (last 24 hours)
SELECT
  'RECENT TRIAL SUBSCRIPTIONS' as section,
  COUNT(*) as total_trials_24h
FROM "Subscription"
WHERE "trialStartDate" IS NOT NULL
  AND "trialStartDate" >= NOW() - INTERVAL '24 hours';

-- Latest 5 trial subscriptions with onboarding data check
SELECT
  'LATEST TRIALS WITH ONBOARDING CHECK' as section,
  s.id as subscription_id,
  s."userId" as user_id,
  s."planName" as plan,
  s."trialStartDate" as trial_start,
  s."trialSource" as source,
  COALESCE(demo_offers.count, 0) as demo_offers_count,
  CASE WHEN notif.user_id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_welcome_notification,
  CASE WHEN checkin.user_id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_checkin_stats,
  CASE WHEN ref.referrer_user_id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_referral_code
FROM "Subscription" s
LEFT JOIN (
  SELECT user_id, COUNT(*) as count
  FROM offers
  WHERE is_demo = true
  GROUP BY user_id
) demo_offers ON demo_offers.user_id = s."userId"
LEFT JOIN LATERAL (
  SELECT user_id FROM user_notifications
  WHERE user_id = s."userId" AND type = 'welcome'
  LIMIT 1
) notif ON true
LEFT JOIN LATERAL (
  SELECT user_id FROM user_checkin_stats
  WHERE user_id = s."userId"
  LIMIT 1
) checkin ON true
LEFT JOIN LATERAL (
  SELECT referrer_user_id FROM referrals
  WHERE referrer_user_id = s."userId"
  LIMIT 1
) ref ON true
WHERE s."trialStartDate" IS NOT NULL
ORDER BY s."trialStartDate" DESC
LIMIT 5;

-- Demo offers summary
SELECT
  'DEMO OFFERS SUMMARY' as section,
  COUNT(*) as total_demo_offers,
  COUNT(DISTINCT user_id) as users_with_demo_offers,
  MIN(created_at) as first_demo_created,
  MAX(created_at) as last_demo_created
FROM offers
WHERE is_demo = true;

-- Demo offers by status
SELECT
  'DEMO OFFERS BY STATUS' as section,
  status,
  COUNT(*) as count
FROM offers
WHERE is_demo = true
GROUP BY status
ORDER BY count DESC;

-- Welcome notifications
SELECT
  'WELCOME NOTIFICATIONS' as section,
  COUNT(*) as total_welcome_notifications,
  MIN(created_at) as first_sent,
  MAX(created_at) as last_sent
FROM user_notifications
WHERE type = 'welcome';

-- Checkin stats initialization
SELECT
  'CHECKIN STATS INITIALIZED' as section,
  COUNT(*) as total_checkin_records,
  COUNT(*) FILTER (WHERE total_checkins = 0) as new_user_count
FROM user_checkin_stats;

-- Referral codes generated
SELECT
  'REFERRAL CODES' as section,
  COUNT(*) as total_referral_codes,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_codes
FROM referrals;

-- Onboarding completeness for recent users
SELECT
  'ONBOARDING COMPLETENESS (Last 10 Trials)' as section,
  COUNT(*) as total_users,
  SUM(CASE WHEN demo_offers >= 8 THEN 1 ELSE 0 END) as users_with_8_demo_offers,
  SUM(CASE WHEN has_notification THEN 1 ELSE 0 END) as users_with_welcome_notif,
  SUM(CASE WHEN has_checkin THEN 1 ELSE 0 END) as users_with_checkin,
  SUM(CASE WHEN has_referral THEN 1 ELSE 0 END) as users_with_referral,
  ROUND(100.0 * SUM(CASE WHEN demo_offers >= 8 AND has_notification AND has_checkin AND has_referral THEN 1 ELSE 0 END) / COUNT(*), 1) as complete_onboarding_pct
FROM (
  SELECT
    s."userId",
    COALESCE(demo.count, 0) as demo_offers,
    EXISTS(SELECT 1 FROM user_notifications WHERE user_id = s."userId" AND type = 'welcome') as has_notification,
    EXISTS(SELECT 1 FROM user_checkin_stats WHERE user_id = s."userId") as has_checkin,
    EXISTS(SELECT 1 FROM referrals WHERE referrer_user_id = s."userId") as has_referral
  FROM "Subscription" s
  LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM offers
    WHERE is_demo = true
    GROUP BY user_id
  ) demo ON demo.user_id = s."userId"
  WHERE s."trialStartDate" IS NOT NULL
  ORDER BY s."trialStartDate" DESC
  LIMIT 10
) recent_users;

SQL

echo ""
echo "✅ Database verification completed"
echo ""
echo "Expected onboarding data for each new trial user:"
echo "  - 8 demo offers (Nike, Amazon, Apple, Adidas, Samsung, Sony, Microsoft, Dell)"
echo "  - 1 welcome notification"
echo "  - 1 checkin_stats record (initialized to 0)"
echo "  - 1 referral code (8 character random code)"
