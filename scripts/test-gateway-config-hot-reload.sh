#!/bin/bash

# Gateway Configuration Hot Reload Test Script
# This script tests the configuration hot reload functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-gm-439917}"
TOPIC_NAME="gateway-config-updates"
SERVICE_NAME="gateway-middleware-preview"

echo -e "${GREEN}🧪 Testing Gateway Configuration Hot Reload${NC}"
echo "Project ID: $PROJECT_ID"
echo "Topic: $TOPIC_NAME"
echo "Service: $SERVICE_NAME"
echo ""

# Get the current service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region=asia-northeast1 \
    --project="$PROJECT_ID" \
    --format='value(status.url)' 2>/dev/null || echo "")

if [ -z "$SERVICE_URL" ]; then
    echo -e "${RED}❌ Gateway service '$SERVICE_NAME' not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Gateway service URL: $SERVICE_URL${NC}"

# Function to publish test configuration message
publish_config_message() {
    local action=$1
    local test_id=$2

    MESSAGE='{
      "action": "'$action'",
      "config_path": "/config/routes.yaml",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "version": "test-'$test_id'",
      "test_run": true
    }'

    echo -e "${YELLOW}📤 Publishing configuration message (action: $action, test: $test_id)...${NC}"
    echo "$MESSAGE" | gcloud pubsub topics publish "$TOPIC_NAME" --project="$PROJECT_ID"
    echo -e "${GREEN}✅ Message published${NC}"
}

# Test 1: Test basic configuration reload
echo -e "${YELLOW}🧪 Test 1: Basic configuration reload${NC}"
publish_config_message "reload" "basic"

# Wait for processing
echo -e "${YELLOW}⏳ Waiting for configuration reload (10 seconds)...${NC}"
sleep 10

# Check recent logs for configuration reload
echo -e "${YELLOW}📋 Checking Gateway logs for configuration reload...${NC}"
echo "Recent Gateway logs:"
gcloud run logs read "$SERVICE_NAME" \
    --region=asia-northeast1 \
    --project="$PROJECT_ID" \
    --limit=20 \
    --filter='textPayload:"Configuration reloaded"' \
    --format="table(timestamp,textPayload)" 2>/dev/null || echo "No configuration reload logs found"

# Test 2: Health check
echo ""
echo -e "${YELLOW}🧪 Test 2: Health check after configuration reload${NC}"
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/health" || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed: $HEALTH_RESPONSE${NC}"
fi

# Test 3: Test metrics endpoint
echo ""
echo -e "${YELLOW}🧪 Test 3: Metrics endpoint after configuration reload${NC}"
METRICS_RESPONSE=$(curl -s "$SERVICE_URL/metrics" | head -5 || echo "FAILED")
if [[ "$METRICS_RESPONSE" == *"gateway_"* ]]; then
    echo -e "${GREEN}✅ Metrics endpoint working${NC}"
else
    echo -e "${RED}❌ Metrics check failed${NC}"
fi

# Test 4: Publish multiple configuration changes in quick succession
echo ""
echo -e "${YELLOW}🧪 Test 4: Multiple rapid configuration changes${NC}"
for i in {1..3}; do
    publish_config_message "reload" "rapid-$i"
    sleep 2
done

# Wait for processing
echo -e "${YELLOW}⏳ Waiting for rapid reloads to process (15 seconds)...${NC}"
sleep 15

# Check logs for rapid reloads
echo -e "${YELLOW}📋 Checking for rapid reload processing...${NC}"
gcloud run logs read "$SERVICE_NAME" \
    --region=asia-northeast1 \
    --project="$PROJECT_ID" \
    --limit=30 \
    --filter='timestamp>="'$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)'"' \
    --format="table(timestamp,textPayload)" 2>/dev/null | grep -E "(Configuration reloaded|reload)" || echo "No recent reload logs found"

# Final verification
echo ""
echo -e "${YELLOW}🧪 Test 5: Final verification${NC}"
echo "Checking for any errors in recent logs..."
ERROR_LOGS=$(gcloud run logs read "$SERVICE_NAME" \
    --region=asia-northeast1 \
    --project="$PROJECT_ID" \
    --limit=50 \
    --filter='severity=ERROR' \
    --format="table(timestamp,textPayload)" 2>/dev/null | wc -l)

if [ "$ERROR_LOGS" -eq 0 ]; then
    echo -e "${GREEN}✅ No error logs found${NC}"
else
    echo -e "${YELLOW}⚠️  Found $ERROR_LOGS error logs - check manually${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Configuration Hot Reload Testing Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Monitor the Gateway logs for ongoing configuration reload events:"
echo "   gcloud run logs read $SERVICE_NAME --region=asia-northeast1 --project=$PROJECT_ID --limit=50"
echo ""
echo "2. To manually trigger configuration reload:"
echo "   echo '{\"action\":\"reload\"}' | gcloud pubsub topics publish $TOPIC_NAME --project=$PROJECT_ID"
echo ""
echo "3. To test with actual configuration file changes:"
echo "   - Update /config/routes.yaml in the Gateway service"
echo "   - Trigger configuration reload via Pub/Sub"
echo "   - Verify changes are applied"