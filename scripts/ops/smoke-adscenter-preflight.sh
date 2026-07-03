#!/usr/bin/env bash
set -euo pipefail

# Quick smoke for Adscenter preflight endpoint (OAS-aligned response).
# Usage:
#   BASE=https://adscenter-<hash>-ane1.run.app AUTH="Bearer <id-token>" \
#   ./scripts/ops/smoke-adscenter-preflight.sh <accountId> [landingUrl]

BASE="${BASE:-http://localhost:8086}"
AUTHZ="${AUTH:-}"
ACC="${1:-}"
LANDING="${2:-}"

if [[ -z "$ACC" ]]; then
  echo "Usage: $0 <accountId> [landingUrl]" >&2
  exit 2
fi

body=$(jq -nc --arg acc "$ACC" --arg land "$LANDING" '{accountId:$acc, validateOnly:true} | if $land != "" then .+{landingUrl:$land} else . end')

hdrs=( -H 'Content-Type: application/json' -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[adscenter] POST /api/v1/adscenter/preflight"
curl -sS -X POST "$BASE/api/v1/adscenter/preflight" "${hdrs[@]}" -d "$body" | jq '.summary, (.checks|length), .checks[0]'
echo "[DONE]"

