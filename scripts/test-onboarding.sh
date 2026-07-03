#!/bin/bash
set -e

# Test script for new user onboarding system
# This script creates a test trial subscription and verifies onboarding initialization

BILLING_SERVICE_URL="https://billing-preview-yt54xvsg5q-an.a.run.app"
OFFER_SERVICE_URL="https://offer-preview-yt54xvsg5q-an.a.run.app"
TEST_USER_ID="test-$(uuidgen | tr '[:upper:]' '[:lower:]')"

echo "🧪 Testing New User Onboarding System"
echo "======================================"
echo ""
echo "Test User ID: $TEST_USER_ID"
echo ""

# Step 1: Create trial subscription
echo "📋 Step 1: Creating trial subscription..."
TRIAL_RESPONSE=$(curl -s -X POST \
  "$BILLING_SERVICE_URL/api/v1/billing/subscriptions/trial" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Service: test-script" \
  -d "{
    \"userId\": \"$TEST_USER_ID\",
    \"days\": 7,
    \"source\": \"self_register\"
  }")

echo "Response: $TRIAL_RESPONSE"
echo ""

# Check if trial creation succeeded
if echo "$TRIAL_RESPONSE" | grep -q "subscriptionId"; then
  echo "✅ Trial subscription created successfully"
  SUBSCRIPTION_ID=$(echo "$TRIAL_RESPONSE" | jq -r '.subscriptionId')
  echo "   Subscription ID: $SUBSCRIPTION_ID"
else
  echo "❌ Trial creation failed"
  exit 1
fi

# Step 2: Wait for async onboarding to complete
echo ""
echo "⏳ Step 2: Waiting 10 seconds for async onboarding..."
sleep 10

# Step 3: Verify demo offers were created
echo ""
echo "📦 Step 3: Checking demo offers..."
# Note: This would require authentication, so we'll check via database or logs instead
echo "   (Demo offer verification requires database access)"

# Step 4: Check logs for onboarding activity
echo ""
echo "📊 Step 4: Checking onboarding logs..."
gcloud logging read \
  "resource.labels.service_name=billing-preview AND jsonPayload.message=~\"$TEST_USER_ID\"" \
  --limit 20 \
  --format="value(jsonPayload.message)" \
  --freshness=2m

echo ""
echo "✅ Test completed!"
echo ""
echo "To verify full onboarding:"
echo "1. Check database for user: $TEST_USER_ID"
echo "2. Query offers: SELECT * FROM offers WHERE user_id = '$TEST_USER_ID' AND is_demo = true;"
echo "3. Query notifications: SELECT * FROM user_notifications WHERE user_id = '$TEST_USER_ID';"
echo "4. Query checkin: SELECT * FROM user_checkin_stats WHERE user_id = '$TEST_USER_ID';"
echo "5. Query referral: SELECT * FROM referrals WHERE referrer_user_id = '$TEST_USER_ID';"
