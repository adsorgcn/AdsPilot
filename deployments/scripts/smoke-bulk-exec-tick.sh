#!/usr/bin/env bash
set -euo pipefail

# Smoke call for execute-tick endpoint via direct URL (no gateway), using X-User-Id header.
# Usage:
#   BASE_URL=https://adscenter-preview-... REGION=asia-northeast1 ./deployments/scripts/smoke-bulk-exec-tick.sh 5

BASE_URL=${BASE_URL:?BASE_URL required (e.g., https://adscenter-<stack>-<hash>-<region>.run.app)}
MAX=${1:-1}

curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: scheduler' \
  "$BASE_URL/api/v1/adscenter/bulk-actions/execute-tick?max=$MAX" | jq .

