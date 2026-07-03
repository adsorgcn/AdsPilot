#!/usr/bin/env bash
set -euo pipefail

# Create N shard Cloud Scheduler jobs for Recommendations offline brand-audit.
# Usage:
#  PROJECT_ID=... RECO_URL=https://recommendations-... SEED_DOMAIN=example.com \
#  TOTAL_SHARDS=10 REGION=asia-northeast1 ACCOUNT_ID=1234567890 CRON="0 3 * * *" \
#  deployments/scripts/create-reco-scheduler-sharded.sh

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
RECO_URL=${RECO_URL:-}
SEED_DOMAIN=${SEED_DOMAIN:-}
ACCOUNT_ID=${ACCOUNT_ID:-}
TOTAL_SHARDS=${TOTAL_SHARDS:-}
CRON=${CRON:-"0 3 * * *"}

if [[ -z "$PROJECT_ID" || -z "$RECO_URL" || -z "$SEED_DOMAIN" || -z "$TOTAL_SHARDS" ]]; then
  echo "Usage: PROJECT_ID=... RECO_URL=... SEED_DOMAIN=... TOTAL_SHARDS=N $0" >&2
  exit 1
fi

for (( i=0; i< TOTAL_SHARDS; i++ )); do
  JOB_ID="reco-brand-audit-${SEED_DOMAIN//./-}-s${i}-of-${TOTAL_SHARDS}"
  BODY=$(cat <<JSON
{
  "seedDomain": "${SEED_DOMAIN}",
  "accountId": "${ACCOUNT_ID}",
  "days": 30,
  "limit": 1000,
  "shard": ${i},
  "totalShards": ${TOTAL_SHARDS}
}
JSON
)
  echo "Ensuring job $JOB_ID..."
  gcloud scheduler jobs create http "$JOB_ID" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --schedule "$CRON" \
    --uri "${RECO_URL%/}/api/v1/recommend/internal/offline/brand-audit" \
    --http-method POST \
    --time-zone "Asia/Tokyo" \
    --description "Offline brand audit shard ${i}/${TOTAL_SHARDS} (seed=${SEED_DOMAIN})" \
    --headers "Content-Type=application/json" \
    --message-body "$BODY" \
    >/dev/null 2>&1 || \
  gcloud scheduler jobs update http "$JOB_ID" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --schedule "$CRON" \
    --uri "${RECO_URL%/}/api/v1/recommend/internal/offline/brand-audit" \
    --http-method POST \
    --time-zone "Asia/Tokyo" \
    --description "Offline brand audit shard ${i}/${TOTAL_SHARDS} (seed=${SEED_DOMAIN})" \
    --headers "Content-Type=application/json" \
    --message-body "$BODY" >/dev/null
done

echo "[OK] Created/updated ${TOTAL_SHARDS} scheduler shard jobs for ${SEED_DOMAIN}."

