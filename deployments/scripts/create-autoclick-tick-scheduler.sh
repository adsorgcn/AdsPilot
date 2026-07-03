#!/usr/bin/env bash
set -euo pipefail

# 为 AutoClick 执行器创建 Cloud Scheduler（Pub/Sub 分发），定期触发：
#   POST /api/v1/batchopen/autoclick/execute-tick?max=N
# 依赖：已部署 Pub/Sub 分发函数（参见 create-pubsub-dispatcher.sh）。
#
# 用法：
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   MAX=5 SCHEDULE="*/5 * * * *" ./deployments/scripts/create-autoclick-tick-scheduler.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-batchopen}
MAX=${MAX:-5}
SCHEDULE=${SCHEDULE:-"*/5 * * * *"}
TOPIC=${TOPIC:-jobs-dispatcher}

if [[ -z "$PROJECT_ID" ]]; then echo "PROJECT_ID required" >&2; exit 2; fi

NAME="$SERVICE-$STACK"
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET="${RUN_URL%/}/api/v1/batchopen/autoclick/execute-tick?max=${MAX}"

# 由分发函数注入 X-Service-Token（ENV），后端中间件按 X-User-Id 识别用户上下文：此处设置为 'scheduler'
HEADERS='{"X-Service-Token":"ENV","Accept":"application/json","X-User-Id":"scheduler"}'

JOB_ID="autoclick-tick-${STACK}-$(date +%s)"

URL="$TARGET" METHOD=POST \
  HEADERS_JSON="$HEADERS" BODY_JSON='{}' \
  PROJECT_ID="$PROJECT_ID" REGION="$REGION" TOPIC="$TOPIC" \
  SCHEDULE="$SCHEDULE" JOB_ID="$JOB_ID" \
  ./deployments/scripts/create-scheduler-pubsub-dispatch.sh

echo "[DONE] AutoClick tick scheduler created: $JOB_ID -> $TARGET"

