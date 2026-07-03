#!/usr/bin/env bash
set -euo pipefail

# Convert a Recommendation Opportunity to Adscenter BulkActionPlan and submit.
# Usage:
#   BASE=http://localhost:8080 AUTH="Bearer <token>" \
#   ./scripts/ops/opportunity-to-bulk.sh <opportunityId>

if [[ $# -lt 1 ]]; then
  echo "Usage: BASE=<url> AUTH='Bearer <token>' $0 <opportunityId>" >&2
  exit 2
fi

BASE=${BASE:-"http://localhost:8080"}
AUTHHDR=${AUTH:-"Bearer dummy"}
OID=$1
hdr=( -H "Authorization: ${AUTHHDR}" -H "Content-Type: application/json" )

echo "[1/5] Fetch opportunity ${OID}"
OP=$(curl -sf ${hdr[@]} "${BASE}/api/v1/recommend/opportunities/${OID}")
echo "$OP" | jq . >/dev/null || { echo "invalid opportunity json" >&2; exit 1; }

SEED=$(echo "$OP" | jq -r '.seedDomain // empty')
COUNTRY=$(echo "$OP" | jq -r '.country // empty')

echo "[2/5] Build BulkActionPlan from opportunity"
# map domain suggestions → ROTATE_LINK; keyword suggestions → ADJUST_CPC
PLAN=$(jq -n --arg seed "$SEED" --arg country "$COUNTRY" --argjson op "$OP" '
  {
    validateOnly: false,
    actions: (
      (
        ($op.topDomains // []) | map(select(.domain != null) | {type:"ROTATE_LINK", params:{seedDomain:$seed, country:$country, targetDomain:.domain}})
      ) + (
        ($op.topKeywords // []) | map(select(.keyword != null) | {type:"ADJUST_CPC", params:{keyword:.keyword, percent:(if (.score // 0) >= 80 then 15 else (if (.score // 0) >= 60 then 10 else 5 end) end), seedDomain:$seed, country:$country}})
      )
    )
  }
')
echo "$PLAN" | jq .

echo "[3/5] Validate plan"
VAL=$(curl -sf ${hdr[@]} -X POST -d "$PLAN" "${BASE}/api/v1/adscenter/bulk-actions/validate")
echo "$VAL" | jq .
OK=$(echo "$VAL" | jq -r '.ok // false')
if [[ "$OK" != "true" ]]; then
  echo "[validate] not ok; aborting" >&2
  exit 3
fi

echo "[4/5] Submit plan"
IDEMP="op2bulk-$(date +%s)-$RANDOM"
SUBMIT=$(curl -sf ${hdr[@]} -H "X-Idempotency-Key: ${IDEMP}" -X POST -d "$PLAN" "${BASE}/api/v1/adscenter/bulk-actions")
echo "$SUBMIT" | jq .
OPID=$(echo "$SUBMIT" | jq -r '.operationId // empty')
if [[ -z "$OPID" ]]; then
  echo "[submit] missing operationId" >&2
  exit 4
fi

echo "[5/5] Execute tick"
curl -sf ${hdr[@]} -X POST "${BASE}/api/v1/adscenter/bulk-actions/execute-tick?max=1" | jq .
echo "[done] operationId=$OPID"

