#!/usr/bin/env bash
set -euo pipefail

# Enable required Google Cloud APIs and grant minimal IAM roles for this project.
# This script is idempotent.
#
# Env:
#   PROJECT_ID (default: GOOGLE_CLOUD_PROJECT)
#   REGION (default: asia-northeast1)

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}"
REGION="${REGION:-asia-northeast1}"

gcloud config set project "$PROJECT_ID" >/dev/null

APIS=(
  run.googleapis.com
  apigateway.googleapis.com
  cloudscheduler.googleapis.com
  pubsub.googleapis.com
  secretmanager.googleapis.com
  monitoring.googleapis.com
  logging.googleapis.com
)

echo "[apis] Enabling required services for $PROJECT_ID ..."
for s in "${APIS[@]}"; do
  gcloud services enable "$s" --project "$PROJECT_ID" || true
done

echo "[apis] Services enable requested. It may take a few minutes to propagate."

# Grant Cloud Scheduler SA invoker on Adscenter (optional convenience)
SVC=adscenter
RUN_URL=$(gcloud run services describe "$SVC" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
if [[ -n "$RUN_URL" ]]; then
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
  SCHEDULER_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
  echo "[iam] Granting run.invoker on Cloud Run service '$SVC' to $SCHEDULER_SA ..."
  gcloud run services add-iam-policy-binding "$SVC" \
    --region="$REGION" \
    --member="serviceAccount:$SCHEDULER_SA" \
    --role="roles/run.invoker" || true
fi

echo "[done] APIs enabled and IAM bindings applied where applicable."

