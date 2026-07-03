#!/usr/bin/env bash
set -euo pipefail

# Configure Cloud Run service scaling parameters.
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 SERVICE=browser-exec \
#   MIN=2 MAX=50 CONCURRENCY=80 CPU=1Gi MEM=1024Mi ./deployments/scripts/set-scaling.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:?REGION required}
SERVICE=${SERVICE:?SERVICE required}
MIN=${MIN:-1}
MAX=${MAX:-10}
CONCURRENCY=${CONCURRENCY:-80}
CPU=${CPU:-}
MEM=${MEM:-}

args=(--region "$REGION" --project "$PROJECT_ID" --min-instances "$MIN" --max-instances "$MAX" --concurrency "$CONCURRENCY")
if [[ -n "$CPU" ]]; then args+=(--cpu "$CPU"); fi
if [[ -n "$MEM" ]]; then args+=(--memory "$MEM"); fi

echo "[scale] $SERVICE min=$MIN max=$MAX q=$CONCURRENCY cpu=${CPU:-default} mem=${MEM:-default}"
gcloud run services update "$SERVICE" "${args[@]}"
echo "[DONE] scaling updated for $SERVICE"

