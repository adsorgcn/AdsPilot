#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
REGION="${REGION:-asia-northeast1}"
if [[ -z "$PROJECT_ID" ]]; then echo "PROJECT_ID required" >&2; exit 1; fi
HOST=$(gcloud api-gateway gateways describe gm-gw --location "$REGION" --format='value(defaultHostname)' --project "$PROJECT_ID")
if [[ -z "$HOST" ]]; then echo "gateway not found" >&2; exit 1; fi
echo "[gw] host=$HOST"

urls=(
  "/readyz"
  "/api/health"
  "/api/health/console"
  "/api/health/adscenter"
)
for u in "${urls[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}\n' "https://$HOST$u" || true)
  echo "  $u -> $code"
done

echo "[tip] If 503 persists shortly after deploy, wait 3-5 minutes and retry. Ensure Cloud Run backends allow unauthenticated access for health endpoints."

