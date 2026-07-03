#!/usr/bin/env bash
set -euo pipefail

# Create multiple Cloud Scheduler jobs (via Pub/Sub dispatcher) for offline brand coverage audit per seed domain and shard.
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 STACK=preview \
#   SEED_DOMAINS="a.com,b.com" TOTAL_SHARDS=2 DAYS=30 COUNTRY=US \
#   SCHEDULE="0 * * * *" HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}' \
#   ./deployments/scripts/create-brand-audit-schedulers.sh
#
# Notes:
# - Uses deployments/scripts/create-scheduler-pubsub-dispatch.sh
# - One job per (seedDomain, shard). JOB_ID format: recommendations-<stack>-brand-audit-<seed>-sh<idx>

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-recommendations}
SEED_DOMAINS=${SEED_DOMAINS:-}
TOTAL_SHARDS=${TOTAL_SHARDS:-1}
DAYS=${DAYS:-30}
COUNTRY=${COUNTRY:-}
SCHEDULE=${SCHEDULE:-"0 * * * *"}
HEADERS_JSON=${HEADERS_JSON:-'{"X-Service-Token":"ENV","Accept":"application/json"}'}
TOPIC=${TOPIC:-jobs-dispatcher}

if [[ -z "$PROJECT_ID" || -z "$SEED_DOMAINS" ]]; then
  echo "PROJECT_ID and SEED_DOMAINS required" >&2
  exit 2
fi

# Resolve Cloud Run URL for recommendations
NAME="${SERVICE}-${STACK}"
RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

URL_BASE="${RUN_URL%/}/api/v1/recommend/internal/offline/brand-coverage-audit"

IFS=',' read -r -a seeds <<< "$SEED_DOMAINS"
for sd in "${seeds[@]}"; do
  sdc=$(echo -n "$sd" | tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-')
  for ((sh=0; sh<${TOTAL_SHARDS}; sh++)); do
    url="$URL_BASE"
    # Build body per job
    if [[ -n "$COUNTRY" ]]; then
      BODY_JSON=$(jq -c -n --arg sd "$sd" --arg c "$COUNTRY" --argjson days "$DAYS" --argjson shard "$sh" --argjson total "$TOTAL_SHARDS" '{seedDomain:$sd,country:$c,days:$days,shard:$sh,totalShards:$total}')
    else
      BODY_JSON=$(jq -c -n --arg sd "$sd" --argjson days "$DAYS" --argjson shard "$sh" --argjson total "$TOTAL_SHARDS" '{seedDomain:$sd,days:$days,shard:$sh,totalShards:$total}')
    fi
    JOB_ID="${SERVICE}-${STACK}-brand-audit-${sdc}-sh${sh}"
    echo "[scheduler] upsert $JOB_ID seed=${sd} shard=${sh}/${TOTAL_SHARDS} -> $url"
    PROJECT_ID="$PROJECT_ID" REGION="$REGION" TOPIC="$TOPIC" \
      JOB_ID="$JOB_ID" SCHEDULE="$SCHEDULE" URL="$url" METHOD=POST \
      HEADERS_JSON="$HEADERS_JSON" BODY_JSON="$BODY_JSON" \
      ./deployments/scripts/create-scheduler-pubsub-dispatch.sh >/dev/null
  done
done

echo "[DONE] Created/updated brand-audit scheduler jobs for seeds: $SEED_DOMAINS (shards=$TOTAL_SHARDS)"

