#!/usr/bin/env bash
set -euo pipefail

# Smoke for PAUSE_KEYWORDS / ENABLE_KEYWORDS (validateOnly)
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" \
#   ./scripts/ops/smoke-adscenter-keywords-status.sh <criterionResourceName>

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
CRN=${1:-}

if [[ -z "$CRN" ]]; then echo "Usage: $0 <criterionResourceName>" >&2; exit 2; fi

read -r -d '' PLAN << JSON
{
  "validateOnly": true,
  "actions": [
    { "type": "PAUSE_KEYWORDS",  "params": { "criterionResourceNames": ["$CRN"] }},
    { "type": "ENABLE_KEYWORDS", "params": { "criterionResourceNames": ["$CRN"] }}
  ]
}
JSON

hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/bulk-actions (PAUSE/ENABLE_KEYWORDS, validateOnly)"
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$PLAN" | jq '.'
echo "[DONE]"

