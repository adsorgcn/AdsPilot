#!/usr/bin/env bash
set -euo pipefail

# Create/update a Cloud Scheduler job to retry Offer KPI DLQ items periodically.
# It calls: POST /api/v1/offers/internal/kpi/retry?max=N with OIDC and X-Service-Token.
#
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   MAX=10 INTERNAL_SERVICE_TOKEN=xxxx \
#   ./deployments/scripts/create-offer-kpi-retry-scheduler.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-offer}
MAX=${MAX:-10}
SCHEDULE=${SCHEDULE:-"*/10 * * * *"}
TOKEN=${INTERNAL_SERVICE_TOKEN:-}
OIDC_SERVICE_ACCOUNT=${OIDC_SERVICE_ACCOUNT:-}

if [[ -z "$PROJECT_ID" || -z "$TOKEN" ]]; then echo "PROJECT_ID and INTERNAL_SERVICE_TOKEN required" >&2; exit 2; fi

NAME="${SERVICE}-${STACK}"
JOB_ID="${SERVICE}-${STACK}-kpi-retry"

RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET_URL="${RUN_URL}/api/v1/offers/internal/kpi/retry?max=${MAX}"

OIDC_ARG=()
if [[ -n "$OIDC_SERVICE_ACCOUNT" ]]; then
  OIDC_ARG=("--oidc-service-account-email=$OIDC_SERVICE_ACCOUNT")
else
  SA=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(template.spec.serviceAccountName)' 2>/dev/null || true)
  if [[ -n "$SA" ]]; then OIDC_ARG=("--oidc-service-account-email=$SA"); fi
fi

if gcloud scheduler jobs describe "$JOB_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    "${OIDC_ARG[@]}" \
    --headers "X-Service-Token=$TOKEN" --headers "Accept=application/json" \
    --time-zone "UTC"
else
  gcloud scheduler jobs create http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    "${OIDC_ARG[@]}" \
    --headers "X-Service-Token=$TOKEN" --headers "Accept=application/json" \
    --time-zone "UTC"
fi

echo "[DONE] Scheduler job ${JOB_ID} -> ${TARGET_URL}"

