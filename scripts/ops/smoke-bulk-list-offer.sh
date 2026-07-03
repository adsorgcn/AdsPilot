#!/usr/bin/env bash
set -euo pipefail

# 按 Offer 过滤批量操作列表的冒烟脚本
# 用法：GATEWAY=https://www.urlchecker.dev AUTH="Bearer <token>" OFFER_ID=off_xxx ./scripts/ops/smoke-bulk-list-offer.sh

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
OFFER_ID=${OFFER_ID:-}

if [[ -z "$GATEWAY" || -z "$AUTH" || -z "$OFFER_ID" ]]; then
  echo "need GATEWAY, AUTH, OFFER_ID" >&2
  exit 2
fi

curl -fsS -m 20 -H "Authorization: ${AUTH}" \
  "${GATEWAY}/api/v1/adscenter/bulk-actions?offerId=${OFFER_ID}&limit=20" | jq -c '.'

echo "[ok] list filtered by offerId=${OFFER_ID}"

