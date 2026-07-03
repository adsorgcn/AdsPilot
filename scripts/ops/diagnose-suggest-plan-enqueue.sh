#!/usr/bin/env bash
set -euo pipefail

# Chain using diagnose suggestions -> plan -> validate -> enqueue -> execute-tick
# Usage:
#   AUTH="Bearer <token>" BASE="https://gateway" ./scripts/ops/diagnose-suggest-plan-enqueue.sh [accountId]

BASE=${BASE:-"http://localhost:8080"}
ACCOUNT=${1:-"123-456-7890"}
AUTHHDR=${AUTH:-"Bearer dummy"}
hdr=( -H "Authorization: ${AUTHHDR}" -H "Content-Type: application/json" )

echo "[1/6] Diagnose to get suggestions"
DIAG=$(curl -sf ${hdr[@]} -X POST -d "{}" "${BASE}/api/v1/adscenter/diagnose")
echo "$DIag" >/dev/null 2>&1 || true

echo "[2/6] Build plan from suggestions"
PLAN_WRAPPER=$(curl -sf ${hdr[@]} -X POST \
  -d "$(jq -n --argjson s "$(echo "$DIAG" | jq '.suggestedActions // []')" '{metrics: {}, suggestedActions: $s}')" \
  "${BASE}/api/v1/adscenter/diagnose/plan")
PLAN_JSON=$(echo "$PLAN_WRAPPER" | jq -c '.plan')
echo "$PLAN_JSON" | jq .

echo "[3/6] Validate plan"
VAL=$(curl -sf ${hdr[@]} -X POST -d "$PLAN_JSON" "${BASE}/api/v1/adscenter/bulk-actions/validate")
echo "$VAL" | jq .

echo "[4/6] Submit plan"
IDEMP="diag-sugg-$(date +%s)-$RANDOM"
SUBMIT=$(curl -sf ${hdr[@]} -H "X-Idempotency-Key: ${IDEMP}" -X POST -d "$PLAN_JSON" "${BASE}/api/v1/adscenter/bulk-actions")
echo "$SUBMIT" | jq .
OPID=$(echo "$SUBMIT" | jq -r '.operationId // empty')

echo "[5/6] Execute tick"
curl -sf ${hdr[@]} -X POST "${BASE}/api/v1/adscenter/bulk-actions/execute-tick?max=1" | jq .

echo "[6/6] Check operation shards"
curl -sf ${hdr[@]} "${BASE}/api/v1/adscenter/bulk-actions/${OPID}/shards" | jq .

echo "[done] op=${OPID}"

