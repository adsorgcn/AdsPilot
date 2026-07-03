#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED: 使用 Pub/Sub 分发器替代 HTTP+OIDC 调度。
# 推荐：`deployments/scripts/create-scheduler-pubsub-dispatch.sh` 并设置
#   URL="https://<adscenter>/api/v1/adscenter/bulk-actions/execute-tick?max=N" HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'
#
# Create/Update a Cloud Scheduler job to drive bulk action shard execution.
# It calls the Adscenter Cloud Run endpoint:
#   POST /api/v1/adscenter/bulk-actions/execute-tick?max=N
#
# Auth: Uses Cloud Scheduler OIDC to authenticate to Cloud Run, and injects X-User-Id=scheduler
# so that backend AuthMiddleware通过显式用户头放行（仅用于内部调度用途）。
#
# Env:
#   PROJECT_ID      GCP project (default: GOOGLE_CLOUD_PROJECT)
#   REGION          Region (default: asia-northeast1)
#   SERVICE_NAME    Cloud Run service name (default: adscenter)
#   SCHEDULE        Cron schedule (default: "* * * * *" every minute)
#   TIME_ZONE       Time zone (default: Asia/Tokyo)
#   JOB_NAME        Scheduler job name (default: adscenter-bulk-exec)
#   MAX_PER_TICK    Shards to process per tick (default: 3, max 50)
#   SA_EMAIL        Service Account for OIDC (default: codex-dev@<project>.iam.gserviceaccount.com)

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-adscenter}"
SCHEDULE="${SCHEDULE:-* * * * *}"
TIME_ZONE="${TIME_ZONE:-Asia/Tokyo}"
JOB_NAME="${JOB_NAME:-adscenter-bulk-exec}"
MAX_PER_TICK="${MAX_PER_TICK:-3}"
SA_EMAIL_DEFAULT="codex-dev@${PROJECT_ID}.iam.gserviceaccount.com"
SA_EMAIL="${SA_EMAIL:-$SA_EMAIL_DEFAULT}"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "[scheduler] Discovering Cloud Run URL for $SERVICE_NAME in $REGION ..."
RUN_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  echo "ERROR: Cloud Run service '$SERVICE_NAME' not found in $REGION" >&2
  exit 1
fi

if ! [[ "$MAX_PER_TICK" =~ ^[0-9]+$ ]]; then MAX_PER_TICK=3; fi
if (( MAX_PER_TICK <= 0 )); then MAX_PER_TICK=1; fi
if (( MAX_PER_TICK > 50 )); then MAX_PER_TICK=50; fi

TARGET_URI="${RUN_URL%/}/api/v1/adscenter/bulk-actions/execute-tick?max=${MAX_PER_TICK}"
AUDIENCE="$RUN_URL"
HDR="X-User-Id=scheduler"

if gcloud scheduler jobs describe "$JOB_NAME" --location "$REGION" >/dev/null 2>&1; then
  echo "[scheduler] Updating existing job $JOB_NAME ..."
  gcloud scheduler jobs update http "$JOB_NAME" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --http-method=POST \
    --uri="$TARGET_URI" \
    --oidc-service-account-email="$SA_EMAIL" \
    --oidc-token-audience="$AUDIENCE" \
    --headers="$HDR"
else
  echo "[scheduler] Creating job $JOB_NAME ..."
  gcloud scheduler jobs create http "$JOB_NAME" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --http-method=POST \
    --uri="$TARGET_URI" \
    --oidc-service-account-email="$SA_EMAIL" \
    --oidc-token-audience="$AUDIENCE" \
    --headers="$HDR"
fi

echo "[scheduler] Done. To run immediately:"
echo "  gcloud scheduler jobs run $JOB_NAME --location=$REGION"
