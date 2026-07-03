#!/usr/bin/env bash
set -euo pipefail

# Deploy API Gateway using a rendered OpenAPI file.
# Required env vars/args:
#   PROJECT_ID  - GCP project id
#   API_ID      - API identifier (e.g., gm-api)
#   GATEWAY_ID  - Gateway identifier (e.g., gm-gw)
#   REGION      - Gateway region (e.g., asia-northeast1)
#   OPENAPI     - Path to rendered OpenAPI (default: out/gateway.yaml)
#   CONFIG_ID   - Config id (default: cfg-$(date +%Y%m%d-%H%M%S))

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
API_ID=${API_ID:?API_ID required}
GATEWAY_ID=${GATEWAY_ID:?GATEWAY_ID required}
REGION=${REGION:?REGION required}
OPENAPI=${OPENAPI:-out/gateway.yaml}
CONFIG_ID=${CONFIG_ID:-cfg-$(date +%Y%m%d-%H%M%S)}

echo "[info] Project: $PROJECT_ID"
echo "[info] API: $API_ID, Gateway: $GATEWAY_ID, Region: $REGION"
echo "[info] Config: $CONFIG_ID, OpenAPI: $OPENAPI"

# Ensure API exists
if ! gcloud api-gateway apis describe "$API_ID" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "[info] Creating API $API_ID";
  gcloud api-gateway apis create "$API_ID" --project "$PROJECT_ID"
else
  echo "[info] API $API_ID exists"
fi

echo "[info] Creating API config $CONFIG_ID"
gcloud api-gateway api-configs create "$CONFIG_ID" \
  --api="$API_ID" \
  --openapi-spec="$OPENAPI" \
  --project="$PROJECT_ID"

# Create or update gateway
if ! gcloud api-gateway gateways describe "$GATEWAY_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "[info] Creating gateway $GATEWAY_ID"
  gcloud api-gateway gateways create "$GATEWAY_ID" \
    --location "$REGION" \
    --api="$API_ID" \
    --api-config="$CONFIG_ID" \
    --project "$PROJECT_ID"
else
  echo "[info] Updating gateway $GATEWAY_ID"
  FULL_CONFIG="projects/${PROJECT_ID}/locations/global/apis/${API_ID}/configs/${CONFIG_ID}"
  gcloud api-gateway gateways update "$GATEWAY_ID" \
    --location "$REGION" \
    --api-config "$FULL_CONFIG" \
    --project "$PROJECT_ID"
fi

echo "[done] Gateway deployed. Describe output:"
gcloud api-gateway gateways describe "$GATEWAY_ID" --location "$REGION" --project "$PROJECT_ID"
