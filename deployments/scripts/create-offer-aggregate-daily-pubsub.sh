#!/usr/bin/env bash
set -euo pipefail

# Create sharded Cloud Scheduler → Pub/Sub dispatcher jobs for Offer KPI aggregate-daily.
# Requires the Pub/Sub dispatcher function and topic created (see create-pubsub-dispatcher.sh).
#
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 STACK=preview \
#   OFFER_URL=https://offer-preview-xxxxx-ane1.run.app \
#   TOTAL_SHARDS=4 SCHEDULE="10 0 * * *" TOPIC=jobs-dispatcher \
#   ./deployments/scripts/create-offer-aggregate-daily-pubsub.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
TOPIC=${TOPIC:-jobs-dispatcher}
OFFER_URL=${OFFER_URL:-}
TOTAL_SHARDS=${TOTAL_SHARDS:-}
SCHEDULE=${SCHEDULE:-"10 0 * * *"}

if [[ -z "$PROJECT_ID" || -z "$OFFER_URL" || -z "$TOTAL_SHARDS" ]]; then
  echo "PROJECT_ID, OFFER_URL and TOTAL_SHARDS are required" >&2
  exit 2
fi

for (( i=0; i<${TOTAL_SHARDS}; i++ )); do
  export PROJECT_ID REGION TOPIC SCHEDULE
  export URL="${OFFER_URL%/}/api/v1/offers/internal/kpi/aggregate-daily?shard=${i}&totalShards=${TOTAL_SHARDS}"
  export METHOD=POST
  export HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'
  export JOB_ID="offer-${STACK}-kpi-agg-${i}-of-${TOTAL_SHARDS}"
  ./deployments/scripts/create-scheduler-pubsub-dispatch.sh
done

echo "[DONE] Created/updated ${TOTAL_SHARDS} KPI aggregate-daily jobs via Pub/Sub dispatcher"

