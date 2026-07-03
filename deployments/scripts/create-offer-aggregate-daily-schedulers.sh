#!/usr/bin/env bash
set -euo pipefail

# Create/update Cloud Scheduler jobs for sharded daily KPI aggregation via internal endpoint.
# It targets: POST /api/v1/offers/internal/kpi/aggregate-daily?date=YYYY-MM-DD&shard=i&totalShards=N
#
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   TOTAL_SHARDS=4 INTERNAL_SERVICE_TOKEN=xxxx \
#   ./deployments/scripts/create-offer-aggregate-daily-schedulers.sh
#
# Env:
#   SERVICE=offer (default)
#   SCHEDULE="10 0 * * *" (UTC)
#   TOTAL_SHARDS (required)
#   INTERNAL_SERVICE_TOKEN (required) – will be set as request header X-Service-Token
#   OIDC_SERVICE_ACCOUNT – defaults to service runtime SA if omitted

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-offer}
SCHEDULE=${SCHEDULE:-"10 0 * * *"}
TOTAL_SHARDS=${TOTAL_SHARDS:-}
OIDC_SERVICE_ACCOUNT=${OIDC_SERVICE_ACCOUNT:-}
TOKEN=${INTERNAL_SERVICE_TOKEN:-}

if [[ -z "$PROJECT_ID" || -z "$TOTAL_SHARDS" || -z "$TOKEN" ]]; then
  echo "PROJECT_ID, TOTAL_SHARDS and INTERNAL_SERVICE_TOKEN are required" >&2
  exit 2
fi

NAME="${SERVICE}-${STACK}"
echo "[resolve] Cloud Run service URL"
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run service URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

OIDC_ARG=()
if [[ -n "$OIDC_SERVICE_ACCOUNT" ]]; then
  OIDC_ARG=("--oidc-service-account-email=$OIDC_SERVICE_ACCOUNT")
else
  SA=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(template.spec.serviceAccountName)' 2>/dev/null || true)
  if [[ -n "$SA" ]]; then OIDC_ARG=("--oidc-service-account-email=$SA"); fi
fi

for (( i=0; i<${TOTAL_SHARDS}; i++ )); do
  JOB_ID="${SERVICE}-${STACK}-kpi-agg-daily-${i}-of-${TOTAL_SHARDS}"
  TARGET_URL="${RUN_URL}/api/v1/offers/internal/kpi/aggregate-daily?shard=${i}&totalShards=${TOTAL_SHARDS}"
  echo "[scheduler] upsert job ${JOB_ID} -> ${TARGET_URL}"
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
done

echo "[DONE] created/updated ${TOTAL_SHARDS} jobs for ${SERVICE}/${STACK}"

