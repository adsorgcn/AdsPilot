#!/usr/bin/env bash
set -euo pipefail

# Create or update a Cloud Scheduler job to trigger offline brand audit.
# Requirements: gcloud authenticated, PROJECT_ID, REGION, RECO_URL, SEED_DOMAIN provided.

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
JOB_ID=${JOB_ID:-reco-brand-audit}
RECO_URL=${RECO_URL:-}
SEED_DOMAIN=${SEED_DOMAIN:-}
ACCOUNT_ID=${ACCOUNT_ID:-}
CRON=${CRON:-"0 3 * * *"} # daily 03:00

if [[ -z "$PROJECT_ID" || -z "$RECO_URL" || -z "$SEED_DOMAIN" ]]; then
  echo "Usage: PROJECT_ID=... RECO_URL=https://recommendations-... SEED_DOMAIN=example.com $0" >&2
  exit 1
fi

BODY=$(cat <<JSON
{
  "seedDomain": "${SEED_DOMAIN}",
  "accountId": "${ACCOUNT_ID}",
  "days": 30,
  "limit": 1000
}
JSON
)

gcloud scheduler jobs create http "$JOB_ID" \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --schedule "$CRON" \
  --uri "${RECO_URL%/}/api/v1/recommend/internal/offline/brand-audit" \
  --http-method POST \
  --time-zone "Asia/Tokyo" \
  --description "Offline brand audit (seed=${SEED_DOMAIN})" \
  --headers "Content-Type=application/json" \
  --message-body "$BODY" \
  || gcloud scheduler jobs update http "$JOB_ID" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --schedule "$CRON" \
    --uri "${RECO_URL%/}/api/v1/recommend/internal/offline/brand-audit" \
    --http-method POST \
    --time-zone "Asia/Tokyo" \
    --description "Offline brand audit (seed=${SEED_DOMAIN})" \
    --headers "Content-Type=application/json" \
    --message-body "$BODY"

echo "[OK] Scheduler job $JOB_ID ensured."

