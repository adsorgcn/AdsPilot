#!/usr/bin/env bash
set -euo pipefail

# One-click tuning for preview stack: set scaling and important non-secret envs
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=preview \
#   ./deployments/scripts/tune-preview.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:?REGION required}
STACK=${STACK:-preview}

# Service names (convention: {service}-{stack})
BE="browser-exec-${STACK}"
SR="siterank-${STACK}"
AD="adscenter-${STACK}"

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

echo "[tune] stack=$STACK project=$PROJECT_ID region=$REGION"

# 1) Scaling
echo "[tune] scaling browser-exec"
PROJECT_ID=$PROJECT_ID REGION=$REGION SERVICE=$BE MIN=1 MAX=30 CONCURRENCY=80 CPU=2 MEM=2048Mi \
  "$ROOT_DIR/deployments/scripts/set-scaling.sh"

echo "[tune] scaling siterank"
PROJECT_ID=$PROJECT_ID REGION=$REGION SERVICE=$SR MIN=1 MAX=20 CONCURRENCY=60 \
  "$ROOT_DIR/deployments/scripts/set-scaling.sh"

echo "[tune] scaling adscenter"
PROJECT_ID=$PROJECT_ID REGION=$REGION SERVICE=$AD MIN=1 MAX=15 CONCURRENCY=60 \
  "$ROOT_DIR/deployments/scripts/set-scaling.sh"

# 2) Non-secret env vars
echo "[tune] env for browser-exec"
PROJECT_ID=$PROJECT_ID REGION=$REGION SERVICE=$BE \
  "$ROOT_DIR/deployments/scripts/set-env-vars.sh" \
  BROWSER_MAX_CONTEXTS=12 BROWSER_MAX_MEMORY_MB=1536

echo "[tune] env for adscenter"
PROJECT_ID=$PROJECT_ID REGION=$REGION SERVICE=$AD \
  "$ROOT_DIR/deployments/scripts/set-env-vars.sh" \
  PREFLIGHT_CACHE_TTL_MS=120000

echo "[tune] env for siterank"
PROJECT_ID=$PROJECT_ID REGION=$REGION SERVICE=$SR \
  "$ROOT_DIR/deployments/scripts/set-env-vars.sh" \
  SIMILARWEB_RETRIES=2

echo "[DONE] preview tuning completed"

