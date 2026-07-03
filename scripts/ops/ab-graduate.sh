#!/usr/bin/env bash
set -euo pipefail

# A/B 毕业最小脚本：标记完成并可选指定 winner，若开启 ADS_ABTEST_GRADUATE_MUTATE=true 则暂停 loser AdGroup
# 用法：
#   GATEWAY=https://www.urlchecker.dev AUTH="Bearer <id_token>" AB_ID=ab_202... WINNER=A bash scripts/ops/ab-graduate.sh

for b in curl jq; do command -v "$b" >/dev/null 2>&1 || { echo "[error] 需要安装 $b" >&2; exit 1; }; done

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
AB_ID=${AB_ID:-}
WINNER=${WINNER:-}
NOTE=${NOTE:-}

if [[ -z "$GATEWAY" || -z "$AUTH" || -z "$AB_ID" ]]; then
  echo "need GATEWAY, AUTH, AB_ID" >&2
  exit 2
fi

body=$(jq -n --arg w "$WINNER" --arg n "$NOTE" '{winner: ($w|tostring), note: ($n|tostring)}')
curl -sS -X POST "$GATEWAY/api/v1/adscenter/ab-tests/$AB_ID/graduate" \
  -H 'Content-Type: application/json' -H "Authorization: ${AUTH}" -d "$body" | jq .

echo "[ok] graduated: $AB_ID"

