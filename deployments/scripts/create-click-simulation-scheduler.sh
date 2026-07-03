#!/usr/bin/env bash
set -euo pipefail

# 通过 Pub/Sub 分发器创建“补点击”定时任务（调用 Browser-Exec /simulate-click）。
# 依赖：已部署 Pub/Sub 分发 Cloud Function（参见 deployments/scripts/create-pubsub-dispatcher.sh）。
#
# 用法示例：
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
#   OFFER_URL="https://example.com/offer?k=abc" SCHEDULE="*/10 * * * *" \
#   ./deployments/scripts/create-click-simulation-scheduler.sh
#
# 可选环境变量：
#   PROJECT_ID    GCP 项目ID（默认取 GOOGLE_CLOUD_PROJECT）
#   REGION        Cloud Run 区域（默认 asia-northeast1）
#   TOPIC         Pub/Sub 主题（默认 jobs-dispatcher）
#   BROWSER_SVC   Browser-Exec 服务名（默认 browser-exec 或带 -<stack> 的名称）
#   STACK         环境后缀（如 preview/prod；若提供，将优先查找 <svc>-<stack>）
#   OFFER_URL     需要模拟点击的 URL（必填）
#   SCHEDULE      Cron 表达式（默认 "*/5 * * * *"，每5分钟）
#   PROXY_JSON    代理参数 JSON（可选，如 '{"country":"US"}'）
#   FINGERPRINT   指纹名称（可选，如 'desktop'）
#   JOB_ID        自定义任务名（默认 auto 生成）
#

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
TOPIC=${TOPIC:-jobs-dispatcher}
BROWSER_SVC=${BROWSER_SVC:-browser-exec}
STACK=${STACK:-}
OFFER_URL=${OFFER_URL:-}
SCHEDULE=${SCHEDULE:-"*/5 * * * *"}
PROXY_JSON=${PROXY_JSON:-"null"}
FINGERPRINT=${FINGERPRINT:-}
JOB_ID=${JOB_ID:-}

if [[ -z "$PROJECT_ID" || -z "$OFFER_URL" ]]; then
  echo "PROJECT_ID 和 OFFER_URL 必填" >&2
  exit 2
fi

gcloud config set project "$PROJECT_ID" >/dev/null

# 解析 Browser-Exec 服务 URL（优先尝试带 stack 的名称）
NAME="$BROWSER_SVC"
if [[ -n "$STACK" ]]; then
  NAME="$BROWSER_SVC-$STACK"
fi
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$BROWSER_SVC" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then
  echo "未找到 Cloud Run 服务 URL: $BROWSER_SVC ($NAME)" >&2
  exit 3
fi

TARGET_URL="${RUN_URL%/}/api/v1/browser/simulate-click"

# 组装请求体
BODY=$(jq -c -n \
  --arg url "$OFFER_URL" \
  --arg fp "$FINGERPRINT" \
  --argjson proxy "$PROXY_JSON" \
  '{url:$url} + ( ($fp|length>0) and {fingerprint:$fp} or {} ) + ( ($proxy|type!="null") and {proxy:$proxy} or {} )')

# 头：使用 X-Service-Token: ENV 由分发器注入环境变量 INTERNAL_SERVICE_TOKEN
HEADERS='{"X-Service-Token":"ENV","Accept":"application/json","Content-Type":"application/json"}'

# 任务名：默认根据 URL 生成稳定哈希
if [[ -z "$JOB_ID" ]]; then
  # 使用 URL 的 sha1 前 10 位
  H=$(printf "%s" "$OFFER_URL" | shasum | awk '{print $1}' | cut -c1-10)
  JOB_ID="autoclick-${STACK:-default}-${H}"
fi

echo "[scheduler] 通过 Pub/Sub 分发调用 ${TARGET_URL} -> ${OFFER_URL}"
URL="$TARGET_URL" METHOD=POST \
  HEADERS_JSON="$HEADERS" BODY_JSON="$BODY" \
  PROJECT_ID="$PROJECT_ID" REGION="$REGION" TOPIC="$TOPIC" \
  SCHEDULE="$SCHEDULE" JOB_ID="$JOB_ID" \
  ./deployments/scripts/create-scheduler-pubsub-dispatch.sh

echo "[DONE] 创建/更新补点击定时任务：$JOB_ID"

