#!/usr/bin/env bash
set -euo pipefail

# 使用渲染后的 gateway.yaml 创建/更新 API 与 Gateway

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-${GCP_PROJECT_ID}}}"
REGION="${REGION:-asia-northeast1}"
API_NAME="${API_NAME:-gm-api}"
API_CONFIG="${API_CONFIG:-gm-v1}"
GATEWAY_NAME="${GATEWAY_NAME:-gm-gw}"
SPEC="${SPEC:-deployments/api-gateway/gateway.rendered.yaml}"

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud api-gateway apis create "$API_NAME" --project="$PROJECT_ID" || true
gcloud api-gateway api-configs create "$API_CONFIG" \
  --api="$API_NAME" --openapi-spec="$SPEC" \
  --project="$PROJECT_ID"

gcloud api-gateway gateways create "$GATEWAY_NAME" \
  --api="$API_NAME" --api-config="$API_CONFIG" \
  --location="$REGION" --project="$PROJECT_ID"

echo "[gateway] Created -> $GATEWAY_NAME"

