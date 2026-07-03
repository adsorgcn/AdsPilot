#!/usr/bin/env bash
set -euo pipefail

# Create Cloud Scheduler → Pub/Sub job for Offer KPI DLQ retry max N.
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 STACK=preview \
#   OFFER_URL=https://offer-preview-xxxxx-ane1.run.app MAX=10 \
#   TOPIC=jobs-dispatcher SCHEDULE="*/10 * * * *" \
#   ./deployments/scripts/create-offer-kpi-retry-pubsub.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
TOPIC=${TOPIC:-jobs-dispatcher}
OFFER_URL=${OFFER_URL:-}
MAX=${MAX:-10}
SCHEDULE=${SCHEDULE:-"*/10 * * * *"}

if [[ -z "$PROJECT_ID" || -z "$OFFER_URL" ]]; then echo "PROJECT_ID and OFFER_URL required" >&2; exit 2; fi

export PROJECT_ID REGION TOPIC SCHEDULE
export URL="${OFFER_URL%/}/api/v1/offers/internal/kpi/retry?max=${MAX}"
export METHOD=POST
export HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'
export JOB_ID="offer-${STACK}-kpi-retry"
./deployments/scripts/create-scheduler-pubsub-dispatch.sh

echo "[DONE] Created/updated KPI DLQ retry job via Pub/Sub dispatcher"

