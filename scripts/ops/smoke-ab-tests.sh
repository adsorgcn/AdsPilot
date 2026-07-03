#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Adscenter A/B tests (MVP)
# Usage:
#   BASE=https://adscenter-preview-... USER_ID=tester ACCOUNT_ID=123 OFFER_ID=offer-1 SEED_AG=ag-100 ./scripts/ops/smoke-ab-tests.sh

BASE=${BASE:-"http://localhost:8080"}
USER_ID=${USER_ID:-"smoke-user"}
ACCOUNT_ID=${ACCOUNT_ID:-"acc-1"}
OFFER_ID=${OFFER_ID:-"offer-1"}
SEED_AG=${SEED_AG:-"ag-100"}

echo "[ab] create"
resp=$(curl -sS -X POST "$BASE/api/v1/adscenter/ab-tests" \
  -H 'Content-Type: application/json' -H "X-User-Id: $USER_ID" \
  -d "{\"accountId\":\"$ACCOUNT_ID\",\"offerId\":\"$OFFER_ID\",\"seedAdGroupId\":\"$SEED_AG\",\"splitA\":50,\"splitB\":50}")
echo "$resp"

echo "[ab] list"
curl -sS "$BASE/api/v1/adscenter/ab-tests" -H "X-User-Id: $USER_ID" | jq .

