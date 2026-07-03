#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 REDIS_URL="redis://<private-ip>:6379/0" ./deployments/scripts/set-redis-url-secret.sh

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
URL=${REDIS_URL:-}

if [[ -z "$PROJECT_ID" || -z "$URL" ]]; then
  echo "PROJECT_ID and REDIS_URL are required" >&2
  exit 1
fi

echo "Ensuring Secret REDIS_URL exists in project $PROJECT_ID ..."
if gcloud secrets describe REDIS_URL --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "$URL" | gcloud secrets versions add REDIS_URL --project "$PROJECT_ID" --data-file=-
else
  gcloud secrets create REDIS_URL --project "$PROJECT_ID" --replication-policy=automatic
  echo "$URL" | gcloud secrets versions add REDIS_URL --project "$PROJECT_ID" --data-file=-
fi

echo "Updating Cloud Run services to mount REDIS_URL secret ..."
services=(siterank adscenter offer billing recommendations batchopen notifications console)
for svc in "${services[@]}"; do
  if gcloud run services describe "$svc" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then
    echo "Updating $svc"
    gcloud run services update "$svc" \
      --project "$PROJECT_ID" --region "$REGION" \
      --update-secrets REDIS_URL=REDIS_URL:latest || true
  else
    echo "Skip $svc (not found)"
  fi
done

echo "Done."

