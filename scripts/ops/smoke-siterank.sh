#!/usr/bin/env bash
set -euo pipefail

# Smoke test for siterank endpoints with idempotency and cache behavior
# Env:
#  SITERANK_URL=https://<run-url>
#  OFFER_ID=<offer id existing in DB with originalUrl>
#  USER_ID=<test user id> (optional; default 'smoke-user')

SITERANK_URL=${SITERANK_URL:?SITERANK_URL required}
OFFER_ID=${OFFER_ID:?OFFER_ID required}
USER_ID=${USER_ID:-smoke-user}

function post_analyze() {
  local key="$1"
  echo "[POST] analyze idempotency=$key"
  curl -sS -X POST "$SITERANK_URL/api/v1/siterank/analyze" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $USER_ID" \
    ${key:+-H "X-Idempotency-Key: $key"} \
    --data "{\"offerId\":\"$OFFER_ID\"}" | jq .
}

function get_latest() {
  echo "[GET] latest for offer $OFFER_ID"
  curl -sS "$SITERANK_URL/api/v1/siterank/$OFFER_ID" -H "X-User-Id: $USER_ID" | jq .
}

key="smoke-$(date +%s)"
post_analyze "$key"
sleep 1
post_analyze "$key"
echo "--- latest ---"
get_latest
echo "[DONE] smoke test finished"

