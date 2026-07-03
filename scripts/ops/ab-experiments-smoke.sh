#!/usr/bin/env bash
set -euo pipefail

# A/B 实验接入冒烟（通过网关）
# 先确保后端服务配置 ADS_ABTEST_LIVE=true 且（可选）ADS_ABTEST_EXPERIMENTS=true
# 用法：
#   GATEWAY=https://www.urlchecker.dev AUTH="Bearer <id_token>" ACCOUNT_ID=<cid> OFFER_ID=<offer> SEED_AG=<ad_group_id> \
#   bash scripts/ops/ab-experiments-smoke.sh

for b in curl jq; do command -v "$b" >/dev/null 2>&1 || { echo "[error] 需要安装 $b" >&2; exit 1; }; done

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
ACCOUNT_ID=${ACCOUNT_ID:-}
OFFER_ID=${OFFER_ID:-off-demo}
SEED_AG=${SEED_AG:-}

if [[ -z "$GATEWAY" || -z "$AUTH" || -z "$ACCOUNT_ID" || -z "$SEED_AG" ]]; then
  echo "need GATEWAY, AUTH, ACCOUNT_ID, SEED_AG" >&2
  exit 2
fi

echo "[ab] create via gateway"
resp=$(curl -sS -X POST "$GATEWAY/api/v1/adscenter/ab-tests" \
  -H 'Content-Type: application/json' -H "Authorization: ${AUTH}" \
  -d "{\"accountId\":\"$ACCOUNT_ID\",\"offerId\":\"$OFFER_ID\",\"seedAdGroupId\":\"$SEED_AG\"}")
echo "$resp" | jq .
id=$(echo "$resp" | jq -r .id)
if [[ -z "$id" || "$id" == null ]]; then echo "[error] create failed" >&2; exit 1; fi

echo "[ab] get detail"
curl -sS "$GATEWAY/api/v1/adscenter/ab-tests/$id" -H "Authorization: ${AUTH}" | jq .

echo "[ok] done"

