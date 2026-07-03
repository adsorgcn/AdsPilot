#!/usr/bin/env bash
set -euo pipefail

# Aggregate smoke for new Adscenter actions (validateOnly)
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <token>" \
#   ./scripts/ops/smoke-adscenter-actions-all.sh \
#     <adGroupResourceName> <criterionResourceName> <campaignResourceName> <campaignResourceNameForBidding>

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
AGR=${1:-}
CRN=${2:-}
CAM_SCH=${3:-}
CAM_BID=${4:-}

hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

if [[ -z "$AGR" || -z "$CRN" || -z "$CAM_SCH" || -z "$CAM_BID" ]]; then
  echo "Usage: $0 <adGroupResourceName> <criterionResourceName> <campaignResourceName> <campaignResourceNameForBidding>" >&2
  exit 2
fi

echo "[1/4] ADD/REMOVE_NEGATIVE_KEYWORDS"
PLAN=$(jq -nc --arg ag "$AGR" '{validateOnly:true,actions:[{type:"ADD_NEGATIVE_KEYWORDS", params:{adGroupResourceNames:[$ag], keywords:["test-shoe"], matchType:"PHRASE"}},{type:"REMOVE_NEGATIVE_KEYWORDS", params:{adGroupResourceNames:[$ag], keywords:["test-shoe"], matchType:"PHRASE"}}]}')
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$PLAN" | jq '.summary? // .'

echo "[2/4] PAUSE/ENABLE_KEYWORDS"
PLAN=$(jq -nc --arg crn "$CRN" '{validateOnly:true,actions:[{type:"PAUSE_KEYWORDS", params:{criterionResourceNames:[$crn]}},{type:"ENABLE_KEYWORDS", params:{criterionResourceNames:[$crn]}}]}')
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$PLAN" | jq '.summary? // .'

echo "[3/4] SET_AD_SCHEDULES"
PLAN=$(jq -nc --arg cam "$CAM_SCH" '{validateOnly:true,actions:[{type:"SET_AD_SCHEDULES", params:{campaignResourceNames:[$cam], schedules:[{dayOfWeek:"MONDAY",startHour:9,startMinute:"ZERO",endHour:18,endMinute:"ZERO"}]}}]}')
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$PLAN" | jq '.summary? // .'

echo "[4/4] SET_TARGET_CPA (1000000 micros) and SET_TARGET_ROAS (2.0)"
PLAN=$(jq -nc --arg cam "$CAM_BID" '{validateOnly:true,actions:[{type:"SET_TARGET_CPA", params:{campaignResourceNames:[$cam], targetCpaMicros:1000000}},{type:"SET_TARGET_ROAS", params:{campaignResourceNames:[$cam], targetRoas:2.0}}]}')
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$PLAN" | jq '.summary? // .'

echo "[DONE]"

