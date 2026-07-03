#!/usr/bin/env bash
set -euo pipefail

# Preview rollback plan for an operation
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" ./scripts/ops/rollback-plan-preview.sh <operationId>

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
OPID=${1:-}

if [[ -z "$OPID" ]]; then echo "Usage: $0 <operationId>" >&2; exit 2; fi

hdrs=( -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] GET /api/v1/adscenter/bulk-actions/$OPID/rollback-plan"
curl -sS "$BASE/api/v1/adscenter/bulk-actions/$OPID/rollback-plan" "${hdrs[@]}" | jq '.'
echo "[DONE]"

