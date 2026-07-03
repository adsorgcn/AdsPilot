#!/usr/bin/env bash
set -euo pipefail

# Create/Update Secret Manager secret for Adscenter limits policy and bind to Cloud Run service.
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 SERVICE=adscenter \
#   SECRET_NAME=adscenter-limits-preview FILE=limits.json ./deployments/scripts/set-adscenter-limits-secret.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}
REGION=${REGION:-asia-northeast1}
SERVICE=${SERVICE:-adscenter}
SECRET_NAME=${SECRET_NAME:-adscenter-limits}
FILE=${FILE:?FILE required (path to limits JSON)}

gcloud config set project "$PROJECT_ID" >/dev/null

if ! gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  echo "[secret] creating $SECRET_NAME"
  gcloud secrets create "$SECRET_NAME" --replication-policy=automatic
fi
echo "[secret] adding new version from $FILE"
gcloud secrets versions add "$SECRET_NAME" --data-file="$FILE"

RUN_URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  echo "[warn] Cloud Run service $SERVICE not found in $REGION (skip binding env)"
  exit 0
fi
echo "[run] setting env ADSCENTER_LIMITS_SECRET=$SECRET_NAME on $SERVICE"
gcloud run services update "$SERVICE" --region="$REGION" --update-env-vars="ADSCENTER_LIMITS_SECRET=$SECRET_NAME"
echo "[done]"

