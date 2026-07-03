#!/usr/bin/env bash
set -euo pipefail

# Validate a bulk action plan (JSON file)
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" ./scripts/ops/validate-plan.sh plan.json

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
PLAN_FILE=${1:-}

if [[ -z "$PLAN_FILE" || ! -f "$PLAN_FILE" ]]; then
  echo "Usage: $0 <plan.json>" >&2
  exit 2
fi

hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/bulk-actions/validate"
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions/validate" "${hdrs[@]}" --data-binary "@${PLAN_FILE}" | jq '.'
echo "[DONE]"

