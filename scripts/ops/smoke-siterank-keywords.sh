#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Siterank keyword suggestion API
# Usage: STACK=preview ./scripts/ops/smoke-siterank-keywords.sh <siterank_base_url> <seed_domain> [country]

BASE_URL=${1:-"http://localhost:8080/api/v1"}
SEED=${2:-"example.com"}
COUNTRY=${3:-""}

echo "[smoke] Suggest keywords for $SEED via $BASE_URL"

BODY=$(jq -n --arg d "$SEED" --arg c "$COUNTRY" '{seedDomain: $d, topN: 10, minScore: 0.4} | if $c != "" then . + {country: $c} else . end')

curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-preview-token" \
  -d "$BODY" \
  "$BASE_URL/siterank/keywords/suggest" | jq .

echo "[done]"

