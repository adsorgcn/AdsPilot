#!/usr/bin/env bash
set -euo pipefail

# Deploy Cloud Functions (2nd gen) Pub/Sub dispatcher (Go) and create topic if missing.
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 STACK=preview \
#   FUNCTION=pubsub-dispatcher TOPIC=jobs-dispatcher INTERNAL_SERVICE_TOKEN=xxxx \
#   ./deployments/scripts/create-pubsub-dispatcher.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
FUNCTION=${FUNCTION:-pubsub-dispatcher}
TOPIC=${TOPIC:-jobs-dispatcher}
TOKEN=${INTERNAL_SERVICE_TOKEN:-}

if [[ -z "$PROJECT_ID" || -z "$TOKEN" ]]; then echo "PROJECT_ID and INTERNAL_SERVICE_TOKEN required" >&2; exit 2; fi

gcloud config set project "$PROJECT_ID" >/dev/null

echo "[topic] ensure $TOPIC"
gcloud pubsub topics describe "$TOPIC" >/dev/null 2>&1 || gcloud pubsub topics create "$TOPIC"

echo "[deploy] Cloud Function $FUNCTION in $REGION"
gcloud functions deploy "$FUNCTION" \
  --gen2 --runtime=go122 --region="$REGION" \
  --entry-point=Dispatch \
  --trigger-topic="$TOPIC" \
  --set-env-vars="INTERNAL_SERVICE_TOKEN=$TOKEN" \
  --source=services/functions/dispatcher \
  --memory=256MiB --timeout=30s

echo "[DONE] Function $FUNCTION deployed and subscribed to topic $TOPIC"

