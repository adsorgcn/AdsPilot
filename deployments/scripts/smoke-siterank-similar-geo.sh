#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Siterank similarity with optional country and geo augmentation
# Usage:
#   HOST=gm-gw-xxxx.an.gateway.dev TOKEN=$ID_TOKEN ./deployments/scripts/smoke-siterank-similar-geo.sh <seed> <country?> <cand1> [cand2 ...]

HOST=${HOST:?HOST required}
TOKEN=${TOKEN:?TOKEN (Firebase ID token) required}
SEED=${1:?seed domain required}
COUNTRY=${2:-}
shift || true
if [[ -n "$COUNTRY" ]]; then shift || true; fi

if [[ $# -eq 0 ]]; then
  echo "[info] no candidates passed; using defaults example.com,example.org" >&2
  set -- example.com example.org
fi

cands_json=$(printf '%s\n' "$@" | jq -R . | jq -s .)
if [[ -n "$COUNTRY" ]]; then
  body=$(jq -n --arg seed "$SEED" --arg c "$COUNTRY" --argjson cands "$cands_json" '{seedDomain:$seed, country:$c, candidates:$cands}')
else
  body=$(jq -n --arg seed "$SEED" --argjson cands "$cands_json" '{seedDomain:$seed, candidates:$cands}')
fi

echo "[smoke] POST /api/v1/siterank/similar seed=$SEED country=${COUNTRY:--} cands=$#"
curl -sS -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -X POST --data "$body" "https://${HOST}/api/v1/siterank/similar" | jq '{items:[.items[]|{domain, score, reason:(.factors.reason//""), overlap:((.factors.countryDetail.overlap//[])|join("|"))}]}'

echo "[done]"

