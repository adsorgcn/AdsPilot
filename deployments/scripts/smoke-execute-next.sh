#!/usr/bin/env bash
set -euo pipefail

# Smoke script: trigger execute-next for a given operation id.
# Usage:
#   BASE_URL=https://adscenter-... OP_ID=20240926... ./deployments/scripts/smoke-execute-next.sh

BASE_URL=${BASE_URL:?BASE_URL required}
OP_ID=${OP_ID:?OP_ID required}

curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: scheduler' \
  "$BASE_URL/api/v1/adscenter/bulk-actions/$OP_ID/execute-next" | jq .

