#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Adscenter bulk action audits endpoint
# Usage:
#   HOST=gm-gw-xxxx.an.gateway.dev TOKEN=$ID_TOKEN ./deployments/scripts/smoke-bulk-audits.sh <operationId>

HOST=${HOST:?HOST required}
TOKEN=${TOKEN:?TOKEN (Firebase ID token) required}
OPID=${1:?operation id required}

echo "[smoke] GET /api/v1/adscenter/bulk-actions/${OPID}/audits"
curl -sS -H "Authorization: Bearer ${TOKEN}" "https://${HOST}/api/v1/adscenter/bulk-actions/${OPID}/audits" | jq . | head -n 80 || true
echo "[done]"
