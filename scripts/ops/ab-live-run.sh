#!/usr/bin/env bash
set -euo pipefail

# One-shot A/B live flow: create -> refresh-metrics -> show
# Usage:
#   BASE=https://adscenter-preview-... USER_ID=<uid> ACCOUNT_ID=<cid> SEED_AG=<ad_group_id> \
#   OFFER_ID=off-demo ./scripts/ops/ab-live-run.sh

for b in curl jq; do command -v "$b" >/dev/null 2>&1 || { echo "[error] require $b" >&2; exit 1; }; done

BASE=${BASE:?BASE required}
USER_ID=${USER_ID:?USER_ID required}
ACCOUNT_ID=${ACCOUNT_ID:?ACCOUNT_ID required}
SEED_AG=${SEED_AG:?SEED_AG required}
OFFER_ID=${OFFER_ID:-off-demo}

echo "[live-ab] create"
resp=$(curl -sS -X POST "$BASE/api/v1/adscenter/ab-tests" \
  -H 'Content-Type: application/json' -H "X-User-Id: $USER_ID" \
  -d "{\"accountId\":\"$ACCOUNT_ID\",\"offerId\":\"$OFFER_ID\",\"seedAdGroupId\":\"$SEED_AG\"}")
echo "$resp" | jq .
abid=$(echo "$resp" | jq -r .id)
if [[ -z "$abid" || "$abid" == null ]]; then echo "[error] create failed" >&2; exit 1; fi

echo "[live-ab] refresh metrics"
curl -sS -X POST "$BASE/api/v1/adscenter/ab-tests/$abid/refresh-metrics" -H 'Content-Type: application/json' -H "X-User-Id: $USER_ID" | jq .

echo "[live-ab] get detail"
curl -sS "$BASE/api/v1/adscenter/ab-tests/$abid" -H "X-User-Id: $USER_ID" | jq .

