#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Adscenter keyword expansion (rule-based, no Ads API)
# Usage:
#   HOST=gm-gw-xxxx.an.gateway.dev TOKEN=$ID_TOKEN ./deployments/scripts/smoke-keywords-expand.sh yitahome.com "home furniture"

HOST=${HOST:?HOST required}
TOKEN=${TOKEN:?TOKEN (Firebase ID token) required}
SEED_DOMAIN=${1:-yitahome.com}
SEED_KEYWORD=${2:-home}

body=$(jq -n --arg d "$SEED_DOMAIN" --arg k "$SEED_KEYWORD" '{seedDomain:$d, seedKeywords:[$k], limit: 10}')
echo "[smoke] POST /api/v1/adscenter/keywords/expand for $SEED_DOMAIN"
curl -sS -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -X POST --data "$body" "https://${HOST}/api/v1/adscenter/keywords/expand" | jq .

echo "[done]"

