#!/usr/bin/env bash
set -euo pipefail

# Production smoke suite: Gateway health + key endpoints
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=prod \
#   ./deployments/scripts/prod-smoke-suite.sh

PROJECT_ID=${PROJECT_ID:?}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-prod}
GATEWAY_ID=$([[ "$STACK" == "prod" ]] && echo gm-gw || echo gm-gw-preview)

HOST=$(gcloud api-gateway gateways describe "$GATEWAY_ID" --location "$REGION" --project "$PROJECT_ID" --format='value(defaultHostname)')
if [[ -z "$HOST" ]]; then echo "[error] gateway host not found" >&2; exit 1; fi
echo "[info] Gateway: https://${HOST}"

curl -fsS "https://${HOST}/api/health" >/dev/null && echo "[ok] /api/health"
curl -fsS "https://${HOST}/api/health/console" >/dev/null && echo "[ok] /api/health/console"
curl -fsS "https://${HOST}/api/health/adscenter" >/dev/null && echo "[ok] /api/health/adscenter"

echo "[note] To run authenticated smoke, export TOKEN=<Firebase ID token> and rerun:"
echo "curl -fsS -H 'Authorization: Bearer $TOKEN' https://${HOST}/api/v1/console/stats | jq ."

