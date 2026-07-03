#!/usr/bin/env bash
set -euo pipefail

# Smoke test for API Gateway v2 (readyz + protected path stubs)
# Usage:
#   BACKEND_BASE=${BACKEND_BASE:-https://gm-gw-885pd7lz.an.gateway.dev}
#   ./scripts/ops/smoke-gateway-v2.sh

BASE=${BACKEND_BASE:-https://gm-gw-885pd7lz.an.gateway.dev}
echo "== Gateway V2: $BASE =="

echo "-- /readyz --"
curl -sS -i "$BASE/readyz" | sed -n '1,10p'

echo "-- protected path sample (no token, expect 401 or 403 by gateway) --"
curl -sS -i "$BASE/api/v1/offers" | sed -n '1,10p' || true

echo "[DONE]"

