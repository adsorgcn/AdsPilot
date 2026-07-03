#!/usr/bin/env bash
set -euo pipefail

# Smoke tests for Billing config and transaction detail
# Usage:
#   HOST=gm-gw-xxxx.an.gateway.dev TOKEN=$ID_TOKEN ./deployments/scripts/smoke-billing.sh [txId]

HOST=${HOST:?HOST required}
TOKEN=${TOKEN:?TOKEN (Firebase ID token) required}
TXID=${1:-}

echo "[smoke] GET /api/v1/billing/config"
curl -sS -H "Authorization: Bearer ${TOKEN}" "https://${HOST}/api/v1/billing/config" | jq .

echo "[smoke] GET /api/v1/billing/tokens/transactions (last 50)"
curl -sS -H "Authorization: Bearer ${TOKEN}" "https://${HOST}/api/v1/billing/tokens/transactions" | jq . | head -n 50 || true

if [[ -n "$TXID" ]]; then
  echo "[smoke] GET /api/v1/billing/tokens/transactions/${TXID}"
  curl -sS -H "Authorization: Bearer ${TOKEN}" "https://${HOST}/api/v1/billing/tokens/transactions/${TXID}" | jq .
fi

echo "[done]"
