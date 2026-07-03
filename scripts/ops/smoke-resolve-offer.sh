#!/usr/bin/env bash
set -euo pipefail

# Smoke test for resolve-offer endpoint
# Env:
#  BROWSER_URL=https://<run-url>
#  WAIT_UNTIL=networkidle|load|domcontentloaded (optional)
#  TIMEOUT_MS=45000 (optional)
#  STABILIZE_MS=1200 (optional)
#  UA="Custom UA" (optional)

if [[ $# -lt 1 ]]; then
  echo "Usage: BROWSER_URL=... $0 <offer-url>" >&2
  exit 1
fi

OFFER_URL="$1"
BROWSER_URL="${BROWSER_URL:?BROWSER_URL required}"
WAIT_UNTIL="${WAIT_UNTIL:-networkidle}"
TIMEOUT_MS="${TIMEOUT_MS:-45000}"
STABILIZE_MS="${STABILIZE_MS:-1200}"
UA="${UA:-}"

if [[ -n "$UA" ]]; then
  body=$(jq -c -n --arg url "$OFFER_URL" --arg wait "$WAIT_UNTIL" --argjson timeout "$TIMEOUT_MS" --argjson stab "$STABILIZE_MS" --arg ua "$UA" '{url:$url, waitUntil:$wait, timeoutMs:($timeout|tonumber), stabilizeMs:($stab|tonumber), userAgent:$ua}')
else
  body=$(jq -c -n --arg url "$OFFER_URL" --arg wait "$WAIT_UNTIL" --argjson timeout "$TIMEOUT_MS" --argjson stab "$STABILIZE_MS" '{url:$url, waitUntil:$wait, timeoutMs:($timeout|tonumber), stabilizeMs:($stab|tonumber)}')
fi

echo "[POST] $BROWSER_URL/api/v1/browser/resolve-offer"
curl -sS -X POST "$BROWSER_URL/api/v1/browser/resolve-offer" \
  -H 'Content-Type: application/json' \
  --data "$body" | jq .

echo "[DONE] resolve-offer smoke"
