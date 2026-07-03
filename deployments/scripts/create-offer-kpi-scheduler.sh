#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED: 使用 Pub/Sub 分发器替代 HTTP+OIDC 调度。
# 推荐：`deployments/scripts/create-offer-aggregate-daily-pubsub.sh`（分片）或
#      `deployments/scripts/create-offer-kpi-retry-pubsub.sh`（DLQ 重试）
#
# Create or update a Cloud Scheduler job to aggregate KPI for a specific offer daily.
# The job will call offer service endpoint with an OIDC token and an explicit X-User-Id header.
#
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   OFFER_ID=offer-123 USER_ID=user-abc \
#   ./deployments/scripts/create-offer-kpi-scheduler.sh
#
# Optional env:
#   SERVICE=offer             # Cloud Run service name (default: offer)
#   SCHEDULE="5 0 * * *"     # default: daily at 00:05 UTC
#   OIDC_SERVICE_ACCOUNT=...  # service account email for OIDC; default to service runtime SA

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-offer}
OFFER_ID=${OFFER_ID:-}
USER_ID=${USER_ID:-}
SCHEDULE=${SCHEDULE:-"5 0 * * *"}
OIDC_SERVICE_ACCOUNT=${OIDC_SERVICE_ACCOUNT:-}

if [[ -z "$PROJECT_ID" || -z "$OFFER_ID" || -z "$USER_ID" ]]; then
  echo "PROJECT_ID, OFFER_ID and USER_ID are required" >&2
  exit 2
fi

NAME="${SERVICE}-${STACK}"
JOB_ID="${SERVICE}-${STACK}-offer-kpi-$(echo "$OFFER_ID" | tr -cd '[:alnum:]' | cut -c1-16)"

echo "[resolve] Cloud Run service URL"
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET_URL="${RUN_URL}/api/v1/offers/${OFFER_ID}/kpi/aggregate"

OIDC_ARG=()
if [[ -n "$OIDC_SERVICE_ACCOUNT" ]]; then
  OIDC_ARG=("--oidc-service-account-email=$OIDC_SERVICE_ACCOUNT")
else
  SA=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(template.spec.serviceAccountName)' 2>/dev/null || true)
  if [[ -n "$SA" ]]; then OIDC_ARG=("--oidc-service-account-email=$SA"); fi
fi

HEADERS=("X-User-Id=$USER_ID" "Accept=application/json")

echo "[scheduler] upsert job ${JOB_ID} -> ${TARGET_URL}"
if gcloud scheduler jobs describe "$JOB_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    "${OIDC_ARG[@]}" \
    --headers "${HEADERS[0]}" --headers "${HEADERS[1]}" \
    --time-zone "UTC"
else
  gcloud scheduler jobs create http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --http-method POST --uri "$TARGET_URL" \
    "${OIDC_ARG[@]}" \
    --headers "${HEADERS[0]}" --headers "${HEADERS[1]}" \
    --time-zone "UTC"
fi

echo "[DONE] Scheduler job ${JOB_ID} -> ${TARGET_URL}"
