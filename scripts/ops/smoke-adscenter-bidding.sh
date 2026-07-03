#!/usr/bin/env bash
set -euo pipefail

# Smoke for SET_TARGET_CPA / SET_TARGET_ROAS (validateOnly)
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" \
#   ./scripts/ops/smoke-adscenter-bidding.sh <campaignResourceName> <type:cpa|roas> <value>

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
CAM=${1:-}
TYPE=${2:-cpa}
VAL=${3:-}

if [[ -z "$CAM" || -z "$VAL" ]]; then echo "Usage: $0 <campaignResourceName> <type:cpa|roas> <value>" >&2; exit 2; fi

actionType="SET_TARGET_CPA"
params="\"targetCpaMicros\": ${VAL}"
if [[ "$TYPE" == roas ]]; then
  actionType="SET_TARGET_ROAS"
  params="\"targetRoas\": ${VAL}"
fi

read -r -d '' PLAN << JSON
{
  "validateOnly": true,
  "actions": [
    {
      "type": "${actionType}",
      "params": {
        "campaignResourceNames": ["$CAM"],
        ${params}
      }
    }
  ]
}
JSON

hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/bulk-actions (${actionType}, validateOnly)"
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$PLAN" | jq '.'
echo "[DONE]"

