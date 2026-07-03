#!/usr/bin/env bash
set -euo pipefail

# Inject INTERNAL_SERVICE_TOKEN as secret-typed env to Cloud Run services
# Usage:
#   PROJECT_ID=<id> REGION=asia-northeast1 TOKEN=<token> SERVICES="console notifications" \
#   ./deployments/scripts/set-internal-service-token-secret.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:-asia-northeast1}
TOKEN=${TOKEN:-}
SERVICES=${SERVICES:-console}

if [[ -z "$TOKEN" ]]; then
  echo "TOKEN required (plain value, will be stored in Secret Manager)" >&2
  exit 2
fi

SECRET_NAME=INTERNAL_SERVICE_TOKEN

echo "[secret] Ensuring secret $SECRET_NAME in project $PROJECT_ID"
if gcloud secrets describe "$SECRET_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo -n "$TOKEN" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project "$PROJECT_ID" >/dev/null
else
  echo -n "$TOKEN" | gcloud secrets create "$SECRET_NAME" --data-file=- --project "$PROJECT_ID" >/dev/null
fi

for svc in $SERVICES; do
  echo "[deploy] Updating $svc with secret-typed env $SECRET_NAME"
  gcloud run services update "$svc" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --set-secrets "$SECRET_NAME=$SECRET_NAME:latest" \
    --quiet
done

echo "Done."

