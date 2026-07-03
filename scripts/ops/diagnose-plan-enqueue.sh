#!/usr/bin/env bash
set -euo pipefail

# Chain: diagnose -> plan (validateOnly) -> validate -> enqueue -> execute tick
# Usage:
#   AUTH="Bearer <token>" BASE="https://gateway.example" ./scripts/ops/diagnose-plan-enqueue.sh [accountId]
# Defaults:
#   BASE=${BASE:-http://localhost:8080}
#   AUTH header must be set via AUTH env or falls back to dummy

BASE=${BASE:-"http://localhost:8080"}
ACCOUNT=${1:-"123-456-7890"}
AUTHHDR=${AUTH:-"Bearer dummy"}

hdr=( -H "Authorization: ${AUTHHDR}" -H "Content-Type: application/json" )

echo "[1/5] Fetching diagnose metrics for accountId=${ACCOUNT}"
METRICS_JSON=$(curl -sf ${hdr[@]} "${BASE}/api/v1/adscenter/diagnose/metrics?accountId=${ACCOUNT}")
echo "$METRICS_JSON" | jq . >/dev/null || { echo "metrics not json" >&2; exit 1; }

echo "[2/5] Generating plan from metrics (validateOnly)"
PLAN_WRAPPER=$(curl -sf ${hdr[@]} -X POST \
  -d "$(jq -n --argjson m "$METRICS_JSON" '{metrics: $m}')" \
  "${BASE}/api/v1/adscenter/diagnose/plan")
echo "$PLAN_WRAPPER" | jq . >/dev/null
PLAN_JSON=$(echo "$PLAN_WRAPPER" | jq -c '.plan')

echo "[3/5] Validating plan"
VAL=$(curl -sf ${hdr[@]} -X POST -d "$PLAN_JSON" "${BASE}/api/v1/adscenter/bulk-actions/validate")
echo "$VAL" | jq . >/dev/null
OK=$(echo "$VAL" | jq -r '.ok // false')
if [[ "$OK" != "true" ]]; then
  echo "[validate] not ok; aborting" >&2
  exit 2
fi

echo "[4/5] Enqueuing plan"
IDEMP="diag-$(date +%s)-$RANDOM"
SUBMIT=$(curl -sf ${hdr[@]} -H "X-Idempotency-Key: ${IDEMP}" -X POST -d "$PLAN_JSON" "${BASE}/api/v1/adscenter/bulk-actions")
echo "$SUBMIT" | jq .
OPID=$(echo "$SUBMIT" | jq -r '.operationId // empty')
if [[ -z "$OPID" ]]; then
  echo "[submit] missing operationId" >&2
  exit 3
fi

echo "[5/5] Execute tick (1 shard)"
TICK=$(curl -sf ${hdr[@]} -X POST "${BASE}/api/v1/adscenter/bulk-actions/execute-tick?max=1")
echo "$TICK" | jq . || true

echo "[done] op=${OPID}"

