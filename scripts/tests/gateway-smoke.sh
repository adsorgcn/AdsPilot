#!/usr/bin/env bash
set -euo pipefail

# API Gateway E2E smoke test
# Usage:
#   GATEWAY_HOST=my-gw-xxxxxxxx-asia-northeast1.apigateway.dev \
#   bash scripts/tests/gateway-smoke.sh [ID_TOKEN]

HOST="${GATEWAY_HOST:-}"
ID_TOKEN="${1:-}"

if [[ -z "$HOST" ]]; then
  echo "Usage: GATEWAY_HOST=<hostname> $0 [FIREBASE_ID_TOKEN]" >&2
  exit 1
fi

HEALTH_PATH="${HEALTH_PATH:-/api/health}"
echo "[gw] Health check (${HEALTH_PATH})"
code=$(curl -sS -o /tmp/gw_health.txt -w "%{http_code}" "https://${HOST}${HEALTH_PATH}")
head -n 1 /tmp/gw_health.txt || true
if [[ "$code" != "200" ]]; then
  echo "[gw] ERROR: healthz expected 200, got $code" >&2
  exit 10
fi

echo "\n[gw] Offers without token (expect 401)"
code=$(curl -sS -o /tmp/gw_unauth.txt -w "%{http_code}" "https://${HOST}/api/v1/offers")
head -n 1 /tmp/gw_unauth.txt || true
if [[ "$code" != "401" && "$code" != "403" ]]; then
  echo "[gw] ERROR: unauth expected 401/403, got $code" >&2
  exit 11
fi

if [[ -n "$ID_TOKEN" ]]; then
  echo "\n[gw] Offers with token (expect 200)"
  code=$(curl -sS -o /tmp/gw_auth.txt -w "%{http_code}" -H "Authorization: Bearer ${ID_TOKEN}" "https://${HOST}/api/v1/offers")
  head -n 1 /tmp/gw_auth.txt || true
  if [[ "$code" != "200" ]]; then
    echo "[gw] ERROR: auth expected 200, got $code" >&2
    exit 12
  fi

  echo "\n[gw] Notifications with token (expect 200)"
  code=$(curl -sS -o /tmp/gw_notif_auth.txt -w "%{http_code}" -H "Authorization: Bearer ${ID_TOKEN}" "https://${HOST}/api/v1/notifications/recent")
  head -n 1 /tmp/gw_notif_auth.txt || true
  if [[ "$code" != "200" ]]; then
    echo "[gw] ERROR: notifications auth expected 200, got $code" >&2
    exit 13
  fi

  echo "\n[gw] Billing subscription with token (expect 200 or 404 if not seeded)"
  code=$(curl -sS -o /tmp/gw_bill_auth.txt -w "%{http_code}" -H "Authorization: Bearer ${ID_TOKEN}" "https://${HOST}/api/v1/billing/subscriptions/me")
  head -n 1 /tmp/gw_bill_auth.txt || true
  if [[ "$code" != "200" && "$code" != "404" ]]; then
    echo "[gw] WARN: billing sub expected 200/404, got $code" >&2
  fi
else
  echo "\n[gw] Skipped authorized call (no ID token provided)"
fi

echo "\n[gw] Done"
