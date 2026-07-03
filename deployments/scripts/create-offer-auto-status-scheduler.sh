#!/usr/bin/env bash
set -euo pipefail

# 创建 Offer 自动状态转换的定时任务（Pub/Sub 分发 -> Offer 内部端点）。
# 触发：POST /api/v1/offers/internal/auto-status
# 认证：X-Service-Token: ENV（由分发函数注入 INTERNAL_SERVICE_TOKEN），需与 Offer 的 SERVICE_INTERNAL_TOKEN 一致。

# 用法：
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   SCHEDULE="*/30 * * * *" ./deployments/scripts/create-offer-auto-status-scheduler.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}} 
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-offer}
SCHEDULE=${SCHEDULE:-"0 * * * *"}
TOPIC=${TOPIC:-jobs-dispatcher}

if [[ -z "$PROJECT_ID" ]]; then echo "PROJECT_ID required" >&2; exit 2; fi

NAME="$SERVICE-$STACK"
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET="${RUN_URL%/}/api/v1/offers/internal/auto-status"

HEADERS='{"X-Service-Token":"ENV","Accept":"application/json","Content-Type":"application/json"}'

JOB_ID="offer-auto-status-${STACK}-$(date +%s)"

URL="$TARGET" METHOD=POST \
  HEADERS_JSON="$HEADERS" BODY_JSON='{}' \
  PROJECT_ID="$PROJECT_ID" REGION="$REGION" TOPIC="$TOPIC" \
  SCHEDULE="$SCHEDULE" JOB_ID="$JOB_ID" \
  ./deployments/scripts/create-scheduler-pubsub-dispatch.sh

echo "[DONE] Offer auto-status scheduler created: $JOB_ID -> $TARGET"

