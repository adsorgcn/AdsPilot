#!/usr/bin/env bash
set -euo pipefail

# Create/update a Cloud Scheduler job to evaluate notification rules periodically.
# Calls: POST /api/v1/console/notifications/rules/evaluate with X-Service-Token.
#
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   INTERNAL_SERVICE_TOKEN=xxxx SCHEDULE="*/5 * * * *" \
#   ./deployments/scripts/create-console-rules-evaluate-scheduler.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-console}
SCHEDULE=${SCHEDULE:-"*/5 * * * *"}
TOKEN=${INTERNAL_SERVICE_TOKEN:-}

if [[ -z "$PROJECT_ID" || -z "$TOKEN" ]]; then echo "PROJECT_ID and INTERNAL_SERVICE_TOKEN required" >&2; exit 2; fi

NAME="${SERVICE}-${STACK}"
JOB_ID="${SERVICE}-${STACK}-rules-evaluate"

RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET_URL="${RUN_URL}/api/v1/console/notifications/rules/evaluate"

if gcloud scheduler jobs describe "$JOB_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    --headers "X-Service-Token=$TOKEN" --headers "Accept=application/json" \
    --time-zone "UTC"
else
  gcloud scheduler jobs create http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    --headers "X-Service-Token=$TOKEN" --headers "Accept=application/json" \
    --time-zone "UTC"
fi

echo "[DONE] Scheduler job ${JOB_ID} -> ${TARGET_URL}"

