#!/usr/bin/env bash
set -euo pipefail

# 生成“胜者计划”（预算上调/失败组下调），默认 validateOnly，用于人审后提交 bulk-actions
# 用法：GATEWAY=... AUTH="Bearer <token>" AB_ID=ab_... [WINNER=A|B] [PERCENT=20] bash scripts/ops/ab-apply-winner-plan.sh

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
AB_ID=${AB_ID:-}
WINNER=${WINNER:-}
PERCENT=${PERCENT:-}

if [[ -z "$GATEWAY" || -z "$AUTH" || -z "$AB_ID" ]]; then echo "need GATEWAY, AUTH, AB_ID" >&2; exit 2; fi

body=$(jq -n --arg w "$WINNER" --argjson p ${PERCENT:-0} '{winner: ($w|tostring), percent: ($p|tonumber)}')
plan=$(curl -sS -X POST "$GATEWAY/api/v1/adscenter/ab-tests/$AB_ID/apply-winner-plan" -H 'Content-Type: application/json' -H "Authorization: ${AUTH}" -d "$body" | jq -c '.plan')
echo "$plan" | jq '.'

echo "[info] validate plan"
curl -sS -X POST "$GATEWAY/api/v1/adscenter/bulk-actions/validate" -H 'Content-Type: application/json' -H "Authorization: ${AUTH}" -d "$plan" | jq '.'

echo "[hint] 若校验通过，可提交：curl -X POST $GATEWAY/api/v1/adscenter/bulk-actions -H 'Authorization: ...' -H 'Content-Type: application/json' -d '<plan>'"

