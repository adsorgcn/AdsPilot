#!/usr/bin/env bash
set -euo pipefail

# Smoke for /api/v1/adscenter/keywords/expand
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" ./scripts/ops/smoke-adscenter-keywords.sh <seedDomain> [seedKeyword]

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
SEED=${1:-}
KEY=${2:-shoes}

if [[ -z "$SEED" ]]; then echo "Usage: $0 <seedDomain> [seedKeyword]" >&2; exit 2; fi
body=$(jq -nc --arg d "$SEED" --arg k "$KEY" '{seedDomain:$d, seedKeywords:[$k], validateOnly:true}')
hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/keywords/expand"
curl -sS -X POST "$BASE/api/v1/adscenter/keywords/expand" "${hdrs[@]}" -d "$body" | jq '.items[0:5]'
echo "[DONE]"

