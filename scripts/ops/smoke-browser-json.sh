#!/usr/bin/env bash
set -euo pipefail

# Smoke test for browser-exec json-fetch endpoint
# Env:
#  BROWSER_URL=https://<run-url>
#  WAIT_UNTIL=domcontentloaded|load|networkidle (optional)
#  TIMEOUT_MS=20000 (optional)
#  UA="Custom UA" (optional)
#  HEADER_KV="Key:Value,Key2:Value2" (optional)

if [[ $# -lt 1 ]]; then
  echo "Usage: BROWSER_URL=... $0 <target-json-url>" >&2
  exit 1
fi

TARGET_URL="$1"
BROWSER_URL="${BROWSER_URL:?BROWSER_URL required}"
WAIT_UNTIL="${WAIT_UNTIL:-domcontentloaded}"
TIMEOUT_MS="${TIMEOUT_MS:-20000}"
UA="${UA:-}"
HEADER_KV="${HEADER_KV:-}"

headers_json='{}'
if [[ -n "$HEADER_KV" ]]; then
  IFS=',' read -ra pairs <<< "$HEADER_KV"
  for kv in "${pairs[@]}"; do
    key="${kv%%:*}"; val="${kv#*:}"
    headers_json=$(jq -c --arg k "$key" --arg v "$val" '. + {($k): $v}' <<< "$headers_json")
  done
fi

if [[ -n "$UA" ]]; then
  body=$(jq -c -n --arg url "$TARGET_URL" --arg wait "$WAIT_UNTIL" --argjson timeout "$TIMEOUT_MS" --arg ua "$UA" --argjson headers "$headers_json" '{url:$url, waitUntil:$wait, timeoutMs:($timeout|tonumber), userAgent:$ua, headers:$headers}')
else
  body=$(jq -c -n --arg url "$TARGET_URL" --arg wait "$WAIT_UNTIL" --argjson timeout "$TIMEOUT_MS" --argjson headers "$headers_json" '{url:$url, waitUntil:$wait, timeoutMs:($timeout|tonumber), headers:$headers}')
fi

echo "[POST] $BROWSER_URL/api/v1/browser/json-fetch"
curl -sS -X POST "$BROWSER_URL/api/v1/browser/json-fetch" \
  -H 'Content-Type: application/json' \
  --data "$body" | jq .

echo "[DONE] json-fetch smoke"
