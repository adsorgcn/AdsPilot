#!/usr/bin/env bash
set -euo pipefail

# Manual build & deploy to Cloud Run (preview) for selected services.
# Prerequisites:
#  - gcloud auth activate-service-account --key-file <sa.json> --project <project>
#  - Artifact Registry repo exists: $PROJECT_ID/$REPO (default: gm-services)
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
#   REPO=gm-services TAG=preview-latest \
#   ./deployments/scripts/manual-build-deploy-preview.sh offer adscenter console

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:-asia-northeast1}
REPO=${REPO:-gm-services}
TAG=${TAG:-preview-latest}

AR_HOST="${REGION}-docker.pkg.dev"

build_service() {
  local svc="$1"
  local image="${AR_HOST}/${PROJECT_ID}/${REPO}/${svc}:${TAG}"
  echo "[build] ${svc} -> ${image}"
  gcloud builds submit . \
    --project "${PROJECT_ID}" \
    --config deployments/cloudbuild/build-service-docker.yaml \
    --gcs-log-dir gs://gm-build-logs-asia-northeast1/logs \
    --substitutions _SERVICE="${svc}",_IMAGE="${image}"
}

deploy_service() {
  local svc="$1"
  local image="${AR_HOST}/${PROJECT_ID}/${REPO}/${svc}:${TAG}"
  echo "[deploy] ${svc} -> ${image}"
  gcloud run deploy "${svc}-${STACK:-preview}" \
    --image "${image}" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --project "${PROJECT_ID}"
}

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <service> [service...]" >&2
  exit 2
fi

for s in "$@"; do
  build_service "$s"
  deploy_service "$s"
done

echo "[DONE] Manual build+deploy complete"

