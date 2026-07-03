#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED: 使用 Pub/Sub 分发器替代 HTTP+OIDC 调度。
# 推荐：`deployments/scripts/create-scheduler-pubsub-dispatch.sh` 并设置
#   TOPIC=jobs-dispatcher URL="https://<adscenter>/api/v1/adscenter/bulk-actions/execute-tick?max=N" \
#   HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'
#
# Create or update a Cloud Scheduler job to call adscenter execute-tick periodically with OIDC.
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   MAX=2 SCHEDULE="* * * * *" ./deployments/scripts/create-execute-tick-scheduler.sh
#
# Env:
#   PROJECT_ID   GCP project id
#   REGION       Cloud Run region (e.g., asia-northeast1)
#   STACK        Environment stack suffix (e.g., preview | prod)
#   SERVICE      Cloud Run service name (default: adscenter)
#   MAX          How many shards per tick (default: 1)
#   SCHEDULE     Cron schedule (default: */5 * * * *)
#   OIDC_SERVICE_ACCOUNT service account email for OIDC token (default: Cloud Run runtime SA of service)

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-adscenter}
MAX=${MAX:-1}
SCHEDULE=${SCHEDULE:-"*/5 * * * *"}
OIDC_SERVICE_ACCOUNT=${OIDC_SERVICE_ACCOUNT:-}

if [[ -z "$PROJECT_ID" ]]; then echo "PROJECT_ID required" >&2; exit 2; fi

NAME="${SERVICE}-${STACK}"
JOB_ID="${SERVICE}-${STACK}-execute-tick"

echo "[resolve] Cloud Run service URL"
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  # fallback to service without stack (some envs may not suffix)
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET_URL="${RUN_URL}/api/v1/adscenter/bulk-actions/execute-tick?max=${MAX}"

OIDC_ARG=()
if [[ -n "$OIDC_SERVICE_ACCOUNT" ]]; then
  OIDC_ARG=("--oidc-service-account-email=$OIDC_SERVICE_ACCOUNT")
else
  # Attempt to use the service's runtime identity
  SA=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(template.spec.serviceAccountName)' 2>/dev/null || true)
  if [[ -n "$SA" ]]; then OIDC_ARG=("--oidc-service-account-email=$SA"); fi
fi

echo "[scheduler] upsert job ${JOB_ID} -> ${TARGET_URL}"
if gcloud scheduler jobs describe "$JOB_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    "${OIDC_ARG[@]}" \
    --time-zone "UTC"
else
  gcloud scheduler jobs create http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    "${OIDC_ARG[@]}" \
    --time-zone "UTC"
fi

echo "[DONE] Scheduler job ${JOB_ID} -> ${TARGET_URL}"
