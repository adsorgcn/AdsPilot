#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Adscenter bulk action report endpoint
# Usage:
#   HOST=gm-gw-xxxx.an.gateway.dev TOKEN=$ID_TOKEN ./deployments/scripts/smoke-bulk-report.sh <operationId> [kind]

HOST=${HOST:?HOST required}
TOKEN=${TOKEN:?TOKEN (Firebase ID token) required}
OPID=${1:?operation id required}
KIND=${2:-}

PATHN="/api/v1/adscenter/bulk-actions/${OPID}/report"
if [[ -n "$KIND" ]]; then
  PATHN+="?kind=${KIND}"
fi

echo "[smoke] GET ${PATHN}"
curl -sS -H "Authorization: Bearer ${TOKEN}" "https://${HOST}${PATHN}" | jq .
echo "[done]"

