#!/usr/bin/env bash
set -euo pipefail

# Deploy API Gateway v2 with Firebase auth, using gateway.v2.yaml
# 1) Render placeholders to gateway.v2.rendered.yaml
# 2) Create/Update API, config, and gateway

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
REGION="${REGION:-asia-northeast1}"
API_NAME="${API_NAME:-gm-api}"
CONFIG_NAME="${CONFIG_NAME:-gm-v2}"
GATEWAY_NAME="${GATEWAY_NAME:-gm-gw}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: PROJECT_ID or GOOGLE_CLOUD_PROJECT required" >&2
  exit 1
fi

# Prefer auto discovery rendering to avoid manual URL envs
STACK="${STACK:-preview}"
PROJECT_ID="$PROJECT_ID" REGION="$REGION" STACK="$STACK" "$(dirname "$0")/render-gateway-auto.sh"

SPEC="$(cd "$(dirname "$0")/.." && pwd)/gateway/gateway.v2.rendered.yaml"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "[gw] Ensuring API $API_NAME exists..."
gcloud api-gateway apis create "$API_NAME" --project "$PROJECT_ID" || true

echo "[gw] Creating/Updating API config $CONFIG_NAME..."
if ! gcloud api-gateway api-configs describe "$CONFIG_NAME" --api="$API_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud api-gateway api-configs create "$CONFIG_NAME" \
    --api="$API_NAME" \
    --openapi-spec="$SPEC" \
    --project="$PROJECT_ID" || true
else
  # Update by creating a timestamped config and pointing gateway to it
  TS=$(date +%Y%m%d%H%M%S)
  NEW_CFG="${CONFIG_NAME}-${TS}"
  echo "[gw] Creating new config ${NEW_CFG} (immutable update)"
  gcloud api-gateway api-configs create "$NEW_CFG" \
    --api="$API_NAME" \
    --openapi-spec="$SPEC" \
    --project="$PROJECT_ID" || true
  CONFIG_NAME="$NEW_CFG"
fi

echo "[gw] Creating/Updating gateway $GATEWAY_NAME in $REGION..."
if ! gcloud api-gateway gateways describe "$GATEWAY_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud api-gateway gateways create "$GATEWAY_NAME" \
    --api="$API_NAME" \
    --api-config="$CONFIG_NAME" \
    --location="$REGION" \
    --project="$PROJECT_ID" || true
else
  gcloud api-gateway gateways update "$GATEWAY_NAME" \
    --api="$API_NAME" \
    --api-config="$CONFIG_NAME" \
    --location="$REGION" \
    --project="$PROJECT_ID" || true
fi

echo "[DONE] Gateway deployed"
