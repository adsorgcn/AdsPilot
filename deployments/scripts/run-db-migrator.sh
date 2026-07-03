#!/usr/bin/env bash
set -euo pipefail

# Run DB migrations via Cloud Run Job (db-migrator)
# Requirements: gcloud auth; Secret Manager contains DATABASE_URL
# Usage:
#   PROJECT_ID=<id> REGION=asia-northeast1 STACK=prod \
#   SA_EMAIL=codex-dev@<project>.iam.gserviceaccount.com \
#   VPC_CONNECTOR=cr-conn-default-ane1 \
#   ./deployments/scripts/run-db-migrator.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SA_EMAIL=${SA_EMAIL:-}
VPC_CONNECTOR=${VPC_CONNECTOR:-}

JOB_NAME="db-migrator-${STACK}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/gm-services/db-migrator:${STACK}-latest"

echo "[db-migrator] Ensuring job ${JOB_NAME} (image=${IMAGE})"
if gcloud run jobs describe "$JOB_NAME" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$JOB_NAME" \
    --project "$PROJECT_ID" --region "$REGION" \
    --image "$IMAGE" \
    --set-env-vars DATABASE_URL_SECRET_NAME=projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest \
    ${SA_EMAIL:+--service-account $SA_EMAIL} \
    ${VPC_CONNECTOR:+--vpc-connector $VPC_CONNECTOR --vpc-egress all-traffic} >/dev/null
else
  gcloud run jobs create "$JOB_NAME" \
    --project "$PROJECT_ID" --region "$REGION" \
    --image "$IMAGE" \
    --set-env-vars DATABASE_URL_SECRET_NAME=projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest \
    ${SA_EMAIL:+--service-account $SA_EMAIL} \
    ${VPC_CONNECTOR:+--vpc-connector $VPC_CONNECTOR --vpc-egress all-traffic} >/dev/null
fi

echo "[db-migrator] Executing job ${JOB_NAME}"
gcloud run jobs execute "$JOB_NAME" --project "$PROJECT_ID" --region "$REGION"

echo "[db-migrator] Done."

