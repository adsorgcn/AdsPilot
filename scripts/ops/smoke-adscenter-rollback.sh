#!/usr/bin/env bash
set -euo pipefail

# Smoke for /api/v1/adscenter/bulk-actions/{id}/rollback
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" ./scripts/ops/smoke-adscenter-rollback.sh <operationId>

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
OPID=${1:-}

if [[ -z "$OPID" ]]; then echo "Usage: $0 <operationId>" >&2; exit 2; fi

hdrs=( -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/bulk-actions/$OPID/rollback"
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions/$OPID/rollback" "${hdrs[@]}" | jq '.'
echo "[DONE]"

