#!/usr/bin/env bash
set -euo pipefail

# Smoke test: billing credit → commit → consistency → plan → (optional) repair
# Usage:
#   GATEWAY=https://www.urlchecker.dev TOKEN="Bearer ey..." ./scripts/ops/smoke-billing-repair.sh

BASE="${GATEWAY:-http://localhost}"
AUTH="${TOKEN:-}"

hdr=( -H "accept: application/json" )
if [[ -n "$AUTH" ]]; then hdr+=( -H "authorization: $AUTH" ); fi

echo "[1] credit purchased 5"
curl -fsS -m 15 -X POST "${BASE%/}/api/v1/billing/tokens/credit/purchased" \
  -H "content-type: application/json" "${hdr[@]}" \
  -d '{"amount":5,"description":"smoke-credit"}' | jq .

echo "[2] commit 3"
curl -fsS -m 15 -X POST "${BASE%/}/api/v1/billing/tokens/commit" \
  -H "content-type: application/json" "${hdr[@]}" \
  -d '{"amount":3,"taskId":"smoke"}' | jq .

echo "[3] consistency (self)"
curl -fsS -m 15 "${BASE%/}/api/v1/billing/tokens/consistency" "${hdr[@]}" | jq .

echo "[4] plan (admin)"
curl -fsS -m 15 "${BASE%/}/api/v1/billing/tokens/consistency/plan" "${hdr[@]}" | jq .

if [[ "${APPLY_REPAIR:-0}" == "1" ]]; then
  echo "[5] repair (admin)"
  curl -fsS -m 15 -X POST "${BASE%/}/api/v1/billing/tokens/consistency/repair" \
    -H "content-type: application/json" "${hdr[@]}" \
    -d '{"confirm":true}' | jq .
fi

echo "[DONE] billing repair smoke"

