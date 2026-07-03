#!/usr/bin/env bash
set -euo pipefail

# Build all backend services via Cloud Build + Kaniko Dockerfiles
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
#   ARTIFACT_REPO=gm-services STACK=preview \
#   ./deployments/scripts/deploy-all-services-cloudbuild.sh billing offer siterank adscenter batchopen console recommendations notifications

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:-asia-northeast1}
ARTIFACT_REPO=${ARTIFACT_REPO:-gm-services}
STACK=${STACK:-preview}

AR_HOST="${REGION}-docker.pkg.dev"
PRIMARY_TAG="${STACK}-$(git rev-parse --short=7 HEAD)"

if [[ $# -eq 0 ]]; then
  SERVICES=(billing offer siterank adscenter batchopen console recommendations notifications)
else
  SERVICES=("$@")
fi

for SVC in "${SERVICES[@]}"; do
  IMAGE="${AR_HOST}/${PROJECT_ID}/${ARTIFACT_REPO}/${SVC}:${PRIMARY_TAG}"
  echo "[build] ${SVC} -> ${IMAGE}"
  gcloud builds submit . \
    --project "${PROJECT_ID}" \
    --config deployments/cloudbuild/build-service-docker.yaml \
    --substitutions _SERVICE="${SVC}",_IMAGE="${IMAGE}" \
    --gcs-log-dir gs://gm-build-logs-asia-northeast1/logs
done

echo "[tag] Also add moving tag ${STACK}-latest"
for SVC in "${SERVICES[@]}"; do
  SRC="${AR_HOST}/${PROJECT_ID}/${ARTIFACT_REPO}/${SVC}:${PRIMARY_TAG}"
  DST="${AR_HOST}/${PROJECT_ID}/${ARTIFACT_REPO}/${SVC}:${STACK}-latest"
  gcloud container images add-tag "$SRC" "$DST" --quiet --project "$PROJECT_ID"
done

echo "[done] Images built and tagged. Use 'gcloud run deploy' per service to rollout."

