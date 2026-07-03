#!/usr/bin/env bash
set -euo pipefail

# E2E smoke: Siterank analyze-url + Adscenter diagnose->plan->validate->submit->execute
# Usage:
#   SITERANK_URL=https://siterank-preview-... ADSCENTER_URL=https://adscenter-preview-... \
#   AUTH="Bearer <token>" ./scripts/ops/e2e-preview.sh

SITERANK_URL=${SITERANK_URL:-}
ADSCENTER_URL=${ADSCENTER_URL:-}
AUTH=${AUTH:-"Bearer dummy"}

if [[ -z "$SITERANK_URL" || -z "$ADSCENTER_URL" ]]; then
  echo "SITERANK_URL and ADSCENTER_URL required" >&2
  exit 2
fi

ts() { date +%s%3N; }
dur() { echo $(( $2 - $1 )); }

echo "[e2e] siterank analyze-url"
t0=$(ts)
RES=$(curl -sf -m 20 -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","offerId":"e2e-offer","country":"US"}' \
  "$SITERANK_URL/api/v1/siterank/analyze-url")
t1=$(ts)
echo "$RES" | jq . >/dev/null || true
echo "[e2e] siterank accepted in $(dur $t0 $t1)ms"

echo "[e2e] adscenter diagnose->plan->validate->submit->execute"
HDR=( -H "Authorization: ${AUTH}" -H 'Content-Type: application/json' )
METRICS=$(curl -sf -m 20 ${HDR[@]} "$ADSCENTER_URL/api/v1/adscenter/diagnose/metrics?accountId=stub")
PLAN=$(curl -sf -m 20 ${HDR[@]} -X POST -d "$(jq -n --argjson m "$METRICS" '{metrics:$m}')" "$ADSCENTER_URL/api/v1/adscenter/diagnose/plan" | jq -c '.plan')
VAL=$(curl -sf -m 20 ${HDR[@]} -X POST -d "$PLAN" "$ADSCENTER_URL/api/v1/adscenter/bulk-actions/validate")
echo "$VAL" | jq .
IDEMP="e2e-$(date +%s)"
SUBMIT=$(curl -sf -m 20 ${HDR[@]} -H "X-Idempotency-Key: ${IDEMP}" -X POST -d "$PLAN" "$ADSCENTER_URL/api/v1/adscenter/bulk-actions")
OPID=$(echo "$SUBMIT" | jq -r '.operationId // empty')
TICK=$(curl -sf -m 20 ${HDR[@]} -X POST "$ADSCENTER_URL/api/v1/adscenter/bulk-actions/execute-tick?max=1")
echo "[e2e] op=$OPID tick=$(echo "$TICK" | jq -c .)"
echo "[e2e] done"

