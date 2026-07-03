#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deployments/scripts/deploy-console-frontend.sh preview|prod
STACK=${1:-preview}
REGION=asia-northeast1
PROJECT_ID=${GCP_PROJECT_ID}
SERVICE="console-frontend-${STACK}"
TAG="${STACK}-$(date +%Y%m%d%H%M%S)"

echo "Building and deploying ${SERVICE} with tag ${TAG}..."
gcloud builds submit apps/console \
  --project "${PROJECT_ID}" \
  --config apps/console/cloudbuild.yaml \
  --substitutions _ENV=${STACK},_TAG=${TAG},_SERVICE=${SERVICE} \
  --timeout=3600

echo "Done. Check Cloud Run service URL:"
gcloud run services describe "${SERVICE}" --region "${REGION}" --format='value(status.url)'

