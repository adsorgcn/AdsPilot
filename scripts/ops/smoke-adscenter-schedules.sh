#!/usr/bin/env bash
set -euo pipefail

# Smoke for SET_AD_SCHEDULES (validateOnly)
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" \
#   ./scripts/ops/smoke-adscenter-schedules.sh <campaignResourceName>

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
CAM=${1:-}

if [[ -z "$CAM" ]]; then echo "Usage: $0 <campaignResourceName>" >&2; exit 2; fi

read -r -d '' PLAN << JSON
{
  "validateOnly": true,
  "actions": [
    {
      "type": "SET_AD_SCHEDULES",
      "params": {
        "campaignResourceNames": ["$CAM"],
        "schedules": [
          {"dayOfWeek":"MONDAY","startHour":9, "startMinute":"ZERO", "endHour":18, "endMinute":"ZERO"},
          {"dayOfWeek":"TUESDAY","startHour":9, "startMinute":"ZERO", "endHour":18, "endMinute":"ZERO"}
        ]
      }
    }
  ]
}
JSON

hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/bulk-actions (SET_AD_SCHEDULES, validateOnly)"
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$PLAN" | jq '.'
echo "[DONE]"

