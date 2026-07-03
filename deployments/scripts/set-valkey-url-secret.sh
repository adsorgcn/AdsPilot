#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 VALKEY_URL="redis://<private-ip>:6379/0" ./deployments/scripts/set-valkey-url-secret.sh

PROJECT_ID=${PROJECT_ID:-}
REGION=${REGION:-asia-northeast1}
URL=${VALKEY_URL:-}

if [[ -z "$PROJECT_ID" || -z "$URL" ]]; then
  echo "PROJECT_ID and VALKEY_URL are required" >&2
  exit 1
fi

echo "Ensuring Secret VALKEY_URL exists in project $PROJECT_ID ..."
if gcloud secrets describe VALKEY_URL --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "$URL" | gcloud secrets versions add VALKEY_URL --project "$PROJECT_ID" --data-file=-
else
  gcloud secrets create VALKEY_URL --project "$PROJECT_ID" --replication-policy=automatic
  echo "$URL" | gcloud secrets versions add VALKEY_URL --project "$PROJECT_ID" --data-file=-
fi

echo "Updating Cloud Run services to mount VALKEY_URL secret ..."
services=(siterank adscenter offer billing recommendations batchopen notifications console)
for svc in "${services[@]}"; do
  if gcloud run services describe "$svc" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then
    echo "Updating $svc"
    gcloud run services update "$svc" \
      --project "$PROJECT_ID" --region "$REGION" \
      --update-secrets VALKEY_URL=VALKEY_URL:latest || true
  else
    echo "Skip $svc (not found)"
  fi
done

echo "Done."

