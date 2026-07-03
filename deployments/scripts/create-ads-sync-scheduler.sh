#!/usr/bin/env bash
set -euo pipefail

# 创建 Adscenter 数据同步 tick 的调度（经 Pub/Sub 分发）
# 触发：POST /api/v1/adscenter/sync/tick?limit=N
# 依赖：已部署 Pub/Sub 分发函数（参见 create-pubsub-dispatcher.sh）。

# 用法：
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview LIMIT=5 \
#   SCHEDULE="0 * * * *" ./deployments/scripts/create-ads-sync-scheduler.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-adscenter}
LIMIT=${LIMIT:-5}
USERS=${USERS:-3}
SCHEDULE=${SCHEDULE:-"0 * * * *"}
TOPIC=${TOPIC:-jobs-dispatcher}

if [[ -z "$PROJECT_ID" ]]; then echo "PROJECT_ID required" >&2; exit 2; fi

NAME="$SERVICE-$STACK"
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET="${RUN_URL%/}/api/v1/adscenter/sync/tick?limit=${LIMIT}&mode=system&users=${USERS}"

# 分发头：内部服务令牌由分发函数用 ENV 注入；用户上下文以 'scheduler' 标识（后端中间件接受 X-User-Id）
HEADERS='{"X-Service-Token":"ENV","Accept":"application/json","X-User-Id":"scheduler"}'

JOB_ID="ads-sync-tick-${STACK}-$(date +%s)"

URL="$TARGET" METHOD=POST \
  HEADERS_JSON="$HEADERS" BODY_JSON='{}' \
  PROJECT_ID="$PROJECT_ID" REGION="$REGION" TOPIC="$TOPIC" \
  SCHEDULE="$SCHEDULE" JOB_ID="$JOB_ID" \
  ./deployments/scripts/create-scheduler-pubsub-dispatch.sh

echo "[DONE] Adscenter sync tick scheduler created: $JOB_ID -> $TARGET"
