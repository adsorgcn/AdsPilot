#!/bin/bash

# Gateway Configuration Hot Reload Setup Script
# This script sets up Pub/Sub subscription for Gateway configuration hot reload

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-gm-439917}"
TOPIC_NAME="gateway-config-updates"
SUBSCRIPTION_NAME="gateway-config-hot-reload-subscription"
SERVICE_NAME="gateway-middleware-preview"

echo -e "${GREEN}🚀 Setting up Gateway Configuration Hot Reload${NC}"
echo "Project ID: $PROJECT_ID"
echo "Topic: $TOPIC_NAME"
echo "Subscription: $SUBSCRIPTION_NAME"
echo ""

# Check if gcloud is authenticated
echo -e "${YELLOW}📋 Checking authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ No active gcloud authentication found. Please run: gcloud auth login${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Authentication OK${NC}"

# Check if Pub/Sub API is enabled
echo -e "${YELLOW}📋 Checking Pub/Sub API...${NC}"
if ! gcloud services list --enabled --project="$PROJECT_ID" | grep -q "pubsub.googleapis.com"; then
    echo -e "${YELLOW}🔧 Enabling Pub/Sub API...${NC}"
    gcloud services enable pubsub.googleapis.com --project="$PROJECT_ID"
    echo -e "${GREEN}✅ Pub/Sub API enabled${NC}"
else
    echo -e "${GREEN}✅ Pub/Sub API already enabled${NC}"
fi

# Create the Pub/Sub topic for configuration updates
echo -e "${YELLOW}📋 Creating Pub/Sub topic...${NC}"
if gcloud pubsub topics describe "$TOPIC_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Topic '$TOPIC_NAME' already exists${NC}"
else
    gcloud pubsub topics create "$TOPIC_NAME" --project="$PROJECT_ID"
    echo -e "${GREEN}✅ Topic '$TOPIC_NAME' created${NC}"
fi

# Create the subscription for Gateway service
echo -e "${YELLOW}📋 Creating Pub/Sub subscription...${NC}"
if gcloud pubsub subscriptions describe "$SUBSCRIPTION_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Subscription '$SUBSCRIPTION_NAME' already exists${NC}"
else
    gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
        --topic="$TOPIC_NAME" \
        --project="$PROJECT_ID" \
        --ack-deadline=60 \
        --message-retention-duration=7d \
        --expiration-period=never
    echo -e "${GREEN}✅ Subscription '$SUBSCRIPTION_NAME' created${NC}"
fi

# Get the current Gateway service configuration
echo -e "${YELLOW}📋 Getting current Gateway service configuration...${NC}"
if ! gcloud run services describe "$SERVICE_NAME" --region=asia-northeast1 --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo -e "${RED}❌ Gateway service '$SERVICE_NAME' not found${NC}"
    echo "Available services:"
    gcloud run services list --project="$PROJECT_ID" --format="table(name,status)"
    exit 1
fi

# Get the current service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region=asia-northeast1 \
    --project="$PROJECT_ID" \
    --format='value(status.url)')

echo -e "${GREEN}✅ Gateway service found: $SERVICE_URL${NC}"

# Update Gateway service with configuration hot reload environment variables
echo -e "${YELLOW}📋 Updating Gateway service configuration...${NC}"
gcloud run services update "$SERVICE_NAME" \
    --region=asia-northeast1 \
    --project="$PROJECT_ID" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,CONFIG_HOT_RELOAD_SUBSCRIPTION=$SUBSCRIPTION_NAME" \
    --no-traffic

echo -e "${GREEN}✅ Gateway service updated with hot reload configuration${NC}"

# Test the configuration hot reload by publishing a test message
echo -e "${YELLOW}📋 Testing configuration hot reload...${NC}"
TEST_MESSAGE='{
  "action": "reload",
  "config_path": "/config/routes.yaml",
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "version": "test-1.0"
}'

echo "$TEST_MESSAGE" | gcloud pubsub topics publish "$TOPIC_NAME" --project="$PROJECT_ID"

echo -e "${GREEN}✅ Test configuration message published${NC}"
echo ""

# Display usage instructions
echo -e "${GREEN}🎉 Gateway Configuration Hot Reload Setup Complete!${NC}"
echo ""
echo "Usage:"
echo "1. To trigger a configuration reload, publish a message to the Pub/Sub topic:"
echo "   echo '{\"action\":\"reload\"}' | gcloud pubsub topics publish $TOPIC_NAME --project=$PROJECT_ID"
echo ""
echo "2. To monitor Gateway logs for configuration reload events:"
echo "   gcloud run logs read $SERVICE_NAME --region=asia-northeast1 --project=$PROJECT_ID --limit=50"
echo ""
echo "3. Configuration changes that will be detected:"
echo "   - JWT configuration changes (secret, project URL)"
echo "   - Rate limit changes"
echo "   - Route changes"
echo "   - Proxy configuration changes"
echo ""
echo "Note: Some configuration changes may require a service restart to take full effect."
echo ""

# Display current configuration
echo -e "${YELLOW}📋 Current Configuration:${NC}"
echo "Project ID: $PROJECT_ID"
echo "Topic: $TOPIC_NAME"
echo "Subscription: $SUBSCRIPTION_NAME"
echo "Service URL: $SERVICE_URL"
echo ""

echo -e "${GREEN}✅ Setup completed successfully!${NC}"