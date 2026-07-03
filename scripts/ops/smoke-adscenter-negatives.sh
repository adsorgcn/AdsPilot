#!/usr/bin/env bash
set -euo pipefail

# Smoke for bulk negative keywords actions (validateOnly)
# Usage:
#   BASE=http://localhost:8086 AUTH="Bearer <id-token>" \
#   ./scripts/ops/smoke-adscenter-negatives.sh <adGroupResourceName> <kw1> [kw2]

BASE=${BASE:-http://localhost:8086}
AUTHZ=${AUTH:-}
AG=${1:-}
KW1=${2:-}
KW2=${3:-}

if [[ -z "$AG" || -z "$KW1" ]]; then
  echo "Usage: $0 <adGroupResourceName> <kw1> [kw2]" >&2
  exit 2
fi

arrkws=("$KW1")
if [[ -n "$KW2" ]]; then arrkws+=("$KW2"); fi
kws=$(printf '"%s",' "${arrkws[@]}")
kws="[${kws%,}]"

plan=$(cat <<JSON
{
  "validateOnly": true,
  "actions": [
    {
      "type": "ADD_NEGATIVE_KEYWORDS",
      "params": {
        "adGroupResourceNames": ["$AG"],
        "keywords": $kws,
        "matchType": "PHRASE"
      }
    },
    {
      "type": "REMOVE_NEGATIVE_KEYWORDS",
      "params": {
        "adGroupResourceNames": ["$AG"],
        "keywords": ["$KW1"],
        "matchType": "PHRASE"
      }
    }
  ]
}
JSON
)

hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/bulk-actions (validateOnly=true, negatives)"
curl -sS -X POST "$BASE/api/v1/adscenter/bulk-actions" "${hdrs[@]}" -d "$plan" | jq '.'
echo "[DONE]"

