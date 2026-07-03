#!/bin/bash
# Update API Gateway with latest service OpenAPI specs
# Usage: ./sync-gateway.sh [preview|prod]

set -euo pipefail

ENVIRONMENT="${1:-preview}"
PROJECT_ID="${PROJECT_ID:-${GCP_PROJECT_ID}}"
REGION="${REGION:-asia-northeast1}"

case "$ENVIRONMENT" in
  preview)
    API_ID="gm-api-preview"
    GATEWAY_ID="gm-gw-preview"
    ;;
  prod|production)
    API_ID="gm-api"
    GATEWAY_ID="gm-gw"
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT (must be 'preview' or 'prod')"
    exit 1
    ;;
esac

echo "🚀 Syncing API Gateway for environment: $ENVIRONMENT"
echo "   API ID:     $API_ID"
echo "   Gateway ID: $GATEWAY_ID"
echo "   Region:     $REGION"
echo ""

# Step 1: Merge service OpenAPI specs
echo "📦 Step 1: Merging service OpenAPI specs..."
bash scripts/gateway/merge-openapi.sh out/gateway-merged.yaml

# Step 2: Create API Config
echo "📝 Step 2: Creating API Config..."
CONFIG_ID="${API_ID}-config-$(date +%Y%m%d-%H%M%S)"

gcloud api-gateway api-configs create "$CONFIG_ID" \
  --api="$API_ID" \
  --openapi-spec="out/gateway-merged.yaml" \
  --project="$PROJECT_ID" \
  --display-name="Auto-generated config from service specs"

# Step 3: Update Gateway
echo "🔄 Step 3: Updating API Gateway..."
gcloud api-gateway gateways update "$GATEWAY_ID" \
  --api="$API_ID" \
  --api-config="$CONFIG_ID" \
  --location="$REGION" \
  --project="$PROJECT_ID"

# Step 4: Get Gateway URL
GATEWAY_URL=$(gcloud api-gateway gateways describe "$GATEWAY_ID" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(defaultHostname)')

echo ""
echo "✅ API Gateway updated successfully!"
echo "🌐 Gateway URL: https://$GATEWAY_URL"
echo "📋 Config ID:   $CONFIG_ID"
echo ""
echo "🔗 Test endpoints:"
echo "   https://$GATEWAY_URL/api/v1/offer/health"
echo "   https://$GATEWAY_URL/api/v1/siterank/health"
echo "   https://$GATEWAY_URL/api/v1/console/health"
