#!/bin/bash
# Deployment script for subscription system enhancements
# This script configures GCP Pub/Sub, Cloud Scheduler, and deploys services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"codex-dev-440106"}
REGION=${GCP_REGION:-"asia-northeast1"}
SERVICE_ACCOUNT_KEY=${GCP_SERVICE_ACCOUNT_KEY:-"secrets/gcp_codex_dev.json"}

echo -e "${GREEN}=== Subscription System Deployment ===${NC}"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not found. Please install it first.${NC}"
    exit 1
fi

# Authenticate with GCP
echo -e "${YELLOW}Step 1: Authenticating with GCP...${NC}"
if [ -f "$SERVICE_ACCOUNT_KEY" ]; then
    gcloud auth activate-service-account --key-file="$SERVICE_ACCOUNT_KEY"
    gcloud config set project "$PROJECT_ID"
    echo -e "${GREEN}✓ Authenticated${NC}"
else
    echo -e "${RED}Error: Service account key not found at $SERVICE_ACCOUNT_KEY${NC}"
    exit 1
fi

# Create Pub/Sub topics
echo -e "${YELLOW}Step 2: Creating Pub/Sub topics...${NC}"
topics=(
    "user.checkin.completed"
    "subscription.trial.created"
    "subscription.trial.expired"
    "config.updated"
)

for topic in "${topics[@]}"; do
    if gcloud pubsub topics describe "$topic" --project="$PROJECT_ID" &> /dev/null; then
        echo "  Topic $topic already exists"
    else
        gcloud pubsub topics create "$topic" --project="$PROJECT_ID"
        echo -e "${GREEN}  ✓ Created topic: $topic${NC}"
    fi
done

# Create Pub/Sub subscriptions
echo -e "${YELLOW}Step 3: Creating Pub/Sub subscriptions...${NC}"

# Create dead letter topic first
if gcloud pubsub topics describe "user.checkin.completed-dlq" --project="$PROJECT_ID" &> /dev/null; then
    echo "  Dead letter topic already exists"
else
    gcloud pubsub topics create "user.checkin.completed-dlq" --project="$PROJECT_ID"
    echo -e "${GREEN}  ✓ Created dead letter topic: user.checkin.completed-dlq${NC}"
fi

# Subscription: billing-checkin-handler (with DLQ)
if gcloud pubsub subscriptions describe "billing-checkin-handler" --project="$PROJECT_ID" &> /dev/null; then
    echo "  Subscription billing-checkin-handler already exists"
else
    gcloud pubsub subscriptions create "billing-checkin-handler" \
        --topic="user.checkin.completed" \
        --ack-deadline=60 \
        --message-retention-duration=7d \
        --max-retry-delay=600s \
        --min-retry-delay=10s \
        --dead-letter-topic="user.checkin.completed-dlq" \
        --max-delivery-attempts=3 \
        --project="$PROJECT_ID"
    echo -e "${GREEN}  ✓ Created subscription: billing-checkin-handler${NC}"
fi

# Subscription: useractivity-trial-created
if gcloud pubsub subscriptions describe "useractivity-trial-created" --project="$PROJECT_ID" &> /dev/null; then
    echo "  Subscription useractivity-trial-created already exists"
else
    gcloud pubsub subscriptions create "useractivity-trial-created" \
        --topic="subscription.trial.created" \
        --ack-deadline=30 \
        --message-retention-duration=7d \
        --project="$PROJECT_ID"
    echo -e "${GREEN}  ✓ Created subscription: useractivity-trial-created${NC}"
fi

# Subscription: gateway-config-updated
if gcloud pubsub subscriptions describe "gateway-config-updated" --project="$PROJECT_ID" &> /dev/null; then
    echo "  Subscription gateway-config-updated already exists"
else
    gcloud pubsub subscriptions create "gateway-config-updated" \
        --topic="config.updated" \
        --ack-deadline=30 \
        --message-retention-duration=1d \
        --project="$PROJECT_ID"
    echo -e "${GREEN}  ✓ Created subscription: gateway-config-updated${NC}"
fi

# Create Cloud Scheduler job for trial expiration
echo -e "${YELLOW}Step 4: Creating Cloud Scheduler job...${NC}"

BILLING_SERVICE_URL=${BILLING_SERVICE_URL:-"https://billing-service-url.run.app"}

if gcloud scheduler jobs describe "expire-trial-subscriptions" --location="$REGION" --project="$PROJECT_ID" &> /dev/null; then
    echo "  Scheduler job already exists, updating..."
    gcloud scheduler jobs update http "expire-trial-subscriptions" \
        --location="$REGION" \
        --schedule="0 * * * *" \
        --uri="$BILLING_SERVICE_URL/internal/v1/trials/expire" \
        --http-method=POST \
        --project="$PROJECT_ID"
else
    gcloud scheduler jobs create http "expire-trial-subscriptions" \
        --location="$REGION" \
        --schedule="0 * * * *" \
        --uri="$BILLING_SERVICE_URL/internal/v1/trials/expire" \
        --http-method=POST \
        --description="Expire trial subscriptions hourly" \
        --project="$PROJECT_ID"
    echo -e "${GREEN}  ✓ Created scheduler job: expire-trial-subscriptions${NC}"
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy billing service with updated code"
echo "2. Deploy useractivity service with updated code"
echo "3. Set environment variables:"
echo "   - PUBSUB_ENABLED=true"
echo "   - CHECKIN_TOKEN_MODE=async"
echo "   - BILLING_SERVICE_URL=<your-billing-service-url>"
echo ""
echo "To deploy services, run:"
echo "  ./scripts/deploy-billing-service.sh"
echo "  ./scripts/deploy-useractivity-service.sh"
