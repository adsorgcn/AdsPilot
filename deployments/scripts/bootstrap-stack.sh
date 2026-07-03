#!/usr/bin/env bash
set -euo pipefail

# Bootstrap environment isolation for a given STACK (dev|preview|prod)
# - Names services as {service}-{stack}
# - Apply Cloud Run labels gm-stack=<stack>
# - Render API Gateway config with discovered service URLs
#
# Usage:
#   STACK=preview PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
#     ./deployments/scripts/bootstrap-stack.sh

STACK=${STACK:?STACK required: dev|preview|prod}
PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:-asia-northeast1}

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)

echo "[info] Project: ${PROJECT_ID}  Region: ${REGION}  Stack: ${STACK}"

export PROJECT_ID REGION STACK

echo "[1/4] Ensuring required Google APIs are enabled (idempotent)"
"${ROOT_DIR}/deployments/scripts/enable-apis.sh" || true

echo "[2/4] Naming convention: {service}-{stack} (dry-run output only)"
"${ROOT_DIR}/deployments/scripts/name-services-by-stack.sh" || true

echo "[3/4] Applying Cloud Run labels gm-stack=${STACK}"
"${ROOT_DIR}/deployments/scripts/label-services.sh" || true

echo "[4/4] Rendering API Gateway config for ${STACK}"
"${ROOT_DIR}/deployments/scripts/render-gateway-auto.sh" || true

echo "---"
echo "Next steps:"
echo "1) Secret sync: deployments/scripts/secret-env-sync.sh (ensure per-stack secrets exist)"
echo "2) Deploy Gateway: deployments/scripts/deploy-gateway-v2.sh"
echo "3) Verify: deployments/scripts/gateway-smoke.sh (or gateway-smoke-auth.sh with TOKEN)"

