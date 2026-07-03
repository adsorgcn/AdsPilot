#!/usr/bin/env bash
set -euo pipefail

# Smoke test for frontend /api/admin/login-guard
# Usage:
#   HOST=https://preview.${APP_DOMAIN} ./deployments/scripts/smoke-login-guard.sh
#
# Behavior:
#   - Sends multiple POST requests to trigger rate limit (429) with Retry-After header
#   - Prints summary and exits non-zero if endpoint is not reachable

HOST=${HOST:-}
COUNT=${COUNT:-10}
IP=${TEST_IP:-"198.51.100.42"} # TEST-NET-2

if [[ -z "$HOST" ]]; then
  echo "HOST required (e.g. https://www.urlchecker.dev)" >&2
  exit 2
fi

ok=0
rate=0
for i in $(seq 1 "$COUNT"); do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$HOST/api/admin/login-guard" \
    -H "content-type: application/json" -H "x-real-ip: $IP" -d '{}') || code=000
  if [[ "$code" == "200" ]]; then ok=$((ok+1)); fi
  if [[ "$code" == "429" ]]; then rate=$((rate+1)); fi
  sleep 0.2
done

echo "OK(200)=$ok RATE_LIMIT(429)=$rate TOTAL=$COUNT"
if [[ "$ok" -eq 0 && "$rate" -eq 0 ]]; then
  echo "Endpoint not reachable or unexpected status codes" >&2
  exit 1
fi
exit 0

