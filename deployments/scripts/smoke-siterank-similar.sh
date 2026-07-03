#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Siterank similarity scoring
# Usage:
#   HOST=gm-gw-xxxx.an.gateway.dev TOKEN=$ID_TOKEN ./deployments/scripts/smoke-siterank-similar.sh seed.com a.com b.com

HOST=${HOST:?HOST required}
TOKEN=${TOKEN:?TOKEN (Firebase ID token) required}
SEED=${1:?seed domain required}
shift || true

if [[ $# -eq 0 ]]; then
  echo "[info] no candidates passed; using defaults example.com,example.org" >&2
  set -- example.com example.org
fi

cands_json=$(printf '%s\n' "$@" | jq -R . | jq -s .)
body=$(jq -n --arg seed "$SEED" --argjson cands "$cands_json" '{seedDomain:$seed, candidates:$cands}')

echo "[smoke] POST /api/v1/siterank/similar seed=$SEED cands=$#"
curl -sS -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -X POST --data "$body" "https://${HOST}/api/v1/siterank/similar" | jq .

echo "[done]"

