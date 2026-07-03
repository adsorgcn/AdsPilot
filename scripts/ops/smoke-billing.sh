#!/usr/bin/env bash
set -euo pipefail

# Quick smoke for Billing config and transaction fetch.
# Usage:
#   BILLING_URL=http://localhost:8082 \
#   AUTH="Bearer <id-token>" \
#   ./scripts/ops/smoke-billing.sh [txId]

BASE="${BILLING_URL:-http://localhost:8082}"
AUTHZ="${AUTH:-}"

hdrs=( -H "Accept: application/json" )
if [[ -n "$AUTHZ" ]]; then hdrs+=( -H "Authorization: $AUTHZ" ); fi

echo "[billing] GET /api/v1/billing/config"
curl -sS "${BASE}/api/v1/billing/config" "${hdrs[@]}" | jq . || true

if [[ -n "${1:-}" ]]; then
  echo "[billing] GET /api/v1/billing/tokens/transactions/$1"
  curl -sS "${BASE}/api/v1/billing/tokens/transactions/$1" "${hdrs[@]}" | jq . || true
fi

echo "[DONE]"

