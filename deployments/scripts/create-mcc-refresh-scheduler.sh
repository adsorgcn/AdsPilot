#!/usr/bin/env bash
set -euo pipefail

# Create/Update a Cloud Scheduler job to refresh MCC link statuses periodically.
# It calls the Adscenter Cloud Run service endpoint:
#   POST /api/v1/adscenter/mcc/refresh
#
# DEPRECATED: 使用 Pub/Sub 分发器替代 HTTP+OIDC 调用。
# 推荐：`deployments/scripts/create-scheduler-pubsub-dispatch.sh` 并设置
#   URL="https://<adscenter>/api/v1/adscenter/mcc/refresh" HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'
#
# Auth: Uses Cloud Scheduler OIDC to authenticate to Cloud Run, and injects X-User-Id=scheduler
# so that backend AuthMiddleware passes (pkg/auth supports X-User-Id explicit header).
#
# Env:
#   PROJECT_ID                  GCP project (default: GOOGLE_CLOUD_PROJECT)
#   REGION                      Region (default: asia-northeast1)
#   SERVICE_NAME                Cloud Run service name (default: adscenter)
#   SCHEDULE                    Cron schedule (default: "0 * * * *" hourly)
#   TIME_ZONE                   Time zone (default: Asia/Tokyo)
#   JOB_NAME                    Scheduler job name (default: adscenter-mcc-refresh)
#   SA_EMAIL                    Service Account for OIDC (default: codex-dev@<project>.iam.gserviceaccount.com)

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-adscenter}"
SCHEDULE="${SCHEDULE:-0 * * * *}"
TIME_ZONE="${TIME_ZONE:-Asia/Tokyo}"
JOB_NAME="${JOB_NAME:-adscenter-mcc-refresh}"
TOTAL_SHARDS="${TOTAL_SHARDS:-0}"
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
TARGET_URI="${RUN_URL%/}/api/v1/adscenter/mcc/refresh"
AUDIENCE="$RUN_URL"

echo "[scheduler] Target: $TARGET_URI"

# Headers: inject X-User-Id=scheduler to pass backend AuthMiddleware
HDR="X-User-Id=scheduler"

if [[ "$TOTAL_SHARDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "[scheduler] Creating sharded jobs: TOTAL_SHARDS=$TOTAL_SHARDS"
  for ((i=0; i<TOTAL_SHARDS; i++)); do
    JN="${JOB_NAME}-s${i}"
    BODY_CONTENT="{\"shard\":${i},\"totalShards\":${TOTAL_SHARDS}}"
    if gcloud scheduler jobs describe "$JN" --location "$REGION" >/dev/null 2>&1; then
      echo "[scheduler] Updating $JN ..."
      gcloud scheduler jobs update http "$JN" \
        --location="$REGION" \
        --schedule="$SCHEDULE" \
        --time-zone="$TIME_ZONE" \
        --http-method=POST \
        --uri="$TARGET_URI" \
        --oidc-service-account-email="$SA_EMAIL" \
        --oidc-token-audience="$AUDIENCE" \
        --headers="$HDR" \
        --body-content="$BODY_CONTENT"
    else
      echo "[scheduler] Creating $JN ..."
      gcloud scheduler jobs create http "$JN" \
        --location="$REGION" \
        --schedule="$SCHEDULE" \
        --time-zone="$TIME_ZONE" \
        --http-method=POST \
        --uri="$TARGET_URI" \
        --oidc-service-account-email="$SA_EMAIL" \
        --oidc-token-audience="$AUDIENCE" \
        --headers="$HDR" \
        --body-content="$BODY_CONTENT"
    fi
  done
else
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
fi

echo "[scheduler] Done. To run immediately:"
echo "  gcloud scheduler jobs run $JOB_NAME --location=$REGION"
