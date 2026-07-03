#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Console admin endpoints (needs admin JWT or gateway bypass header in trusted env).
# Usage:
#   BASE=http://localhost:8080 AUTH="Bearer <admin-id-token>" ./scripts/ops/smoke-console.sh <userId> [amount]

BASE=${BASE:-http://localhost:8080}
AUTHZ=${AUTH:-}
USER=${1:-}
AMOUNT=${2:-10}

hdrs=( -H 'Accept: application/json' )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[console] GET /api/v1/console/tokens/stats"
curl -sS "${BASE}/api/v1/console/tokens/stats" "${hdrs[@]}" | jq . || true

if [[ -n "$USER" ]]; then
  echo "[console] GET /api/v1/console/users/${USER}"
  curl -sS "${BASE}/api/v1/console/users/${USER}" "${hdrs[@]}" | jq . || true
  echo "[console] POST /api/v1/console/users/${USER}/tokens {amount:${AMOUNT}}"
  curl -sS -X POST "${BASE}/api/v1/console/users/${USER}/tokens" \
    -H 'Content-Type: application/json' "${hdrs[@]}" \
    -d "{\"amount\":${AMOUNT}}" | jq . || true
fi

echo "[console] GET /api/v1/console/users?q=@example.com&limit=5"
curl -sS "${BASE}/api/v1/console/users?q=@example.com&limit=5" "${hdrs[@]}" | jq . || true

echo "[DONE]"
