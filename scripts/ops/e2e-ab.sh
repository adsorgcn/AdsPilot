#!/usr/bin/env bash
set -euo pipefail

# E2E A/B 流程（预发最小）：创建 -> 生成赢家计划(校验) -> 毕业
# 用法：GATEWAY=... AUTH="Bearer <id_token>" ACCOUNT_ID=<cid> OFFER_ID=off_xxx SEED_AG=<ad_group_id> bash scripts/ops/e2e-ab.sh

for b in curl jq; do command -v "$b" >/dev/null 2>&1 || { echo "[error] need $b" >&2; exit 1; }; done

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
ACCOUNT_ID=${ACCOUNT_ID:-}
OFFER_ID=${OFFER_ID:-}
SEED_AG=${SEED_AG:-}

if [[ -z "$GATEWAY" || -z "$AUTH" || -z "$ACCOUNT_ID" || -z "$OFFER_ID" || -z "$SEED_AG" ]]; then
  echo "need GATEWAY, AUTH, ACCOUNT_ID, OFFER_ID, SEED_AG" >&2
  exit 2
fi

hdr=(-H "Authorization: ${AUTH}" -H 'Content-Type: application/json')

echo "[ab] create"
resp=$(curl -sS -X POST "$GATEWAY/api/v1/adscenter/ab-tests" "${hdr[@]}" -d "{\"accountId\":\"$ACCOUNT_ID\",\"offerId\":\"$OFFER_ID\",\"seedAdGroupId\":\"$SEED_AG\"}")
echo "$resp" | jq .
id=$(echo "$resp" | jq -r .id)
[[ -n "$id" && "$id" != null ]] || { echo "[error] create failed" >&2; exit 1; }

echo "[ab] apply winner plan (auto)"
plan=$(curl -sS -X POST "$GATEWAY/api/v1/adscenter/ab-tests/$id/apply-winner-plan" "${hdr[@]}" -d '{"winner":"","percent":20,"cpcPercent":10}' | jq -c '.plan')
echo "$plan" | jq '.'

echo "[ab] validate plan"
curl -sS -X POST "$GATEWAY/api/v1/adscenter/bulk-actions/validate" "${hdr[@]}" -d "$plan" | jq .

echo "[ab] graduate (auto winner)"
curl -sS -X POST "$GATEWAY/api/v1/adscenter/ab-tests/$id/graduate" "${hdr[@]}" -d '{"winner":""}' | jq .

echo "[ok] done"

