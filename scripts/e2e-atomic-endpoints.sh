#!/usr/bin/env bash
set -euo pipefail

# End-to-end validator for Go atomic endpoints via Next /go proxy
# Validates: precheck → execute → idempotency → headers (X-Request-Id, Server-Timing, X-RateLimit-*)
# Requirements: curl; jq (optional for pretty JSON)

BASE_URL=${BASE_URL:-"http://127.0.0.1:3000"}
FEATURE=${FEATURE:-"siterank"} # siterank|batchopen|adscenter
COOKIE_STR=${COOKIE:-""}
COOKIE_FILE=${COOKIE_FILE:-""}
REQUEST_ID=${REQUEST_ID:-"e2e-$(date +%s)-$RANDOM"}

usage() {
  cat <<EOF
Usage:
  BASE_URL=http://127.0.0.1:3000 \\
  COOKIE='__Secure-next-auth.session-token=...' \\
  FEATURE=siterank \\
  scripts/e2e-atomic-endpoints.sh

Options (env):
  BASE_URL     Default http://127.0.0.1:3000
  FEATURE      siterank|batchopen|adscenter (default: siterank)
  COOKIE       Raw Cookie header string (preferred)
  COOKIE_FILE  Path to a file containing Cookie header content

Notes:
  - Please sign in to the app first (NextAuth), then copy the Cookie from the browser DevTools
  - This script calls Next's /go/* proxy so it can inject internal RSA JWT & Idempotency-Key.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ -n "$COOKIE_FILE" && -z "$COOKIE_STR" ]]; then
  if [[ -f "$COOKIE_FILE" ]]; then COOKIE_STR=$(cat "$COOKIE_FILE"); else echo "Cookie file not found: $COOKIE_FILE" >&2; exit 1; fi
fi

if [[ -z "$COOKIE_STR" ]]; then
  echo "[E2E] ERROR: COOKIE not provided. Sign in via browser and set COOKIE env or COOKIE_FILE." >&2
  usage
  exit 1
fi

have_jq=0; command -v jq >/dev/null 2>&1 && have_jq=1

uuid_like() { # generate a pseudo UUID if uuidgen not present
  if command -v uuidgen >/dev/null 2>&1; then uuidgen; else openssl rand -hex 16 | sed -E 's/(.{8})(.{4})(.{4})(.{4})(.{12})/\1-\2-\3-\4-\5/'; fi
}

pp() { # pretty print JSON or raw
  if [[ $have_jq -eq 1 ]]; then jq -c '.' 2>/dev/null || cat; else cat; fi
}

curl_json() {
  local method="$1"; shift
  local path="$1"; shift
  local data="$1"; shift
  local idem="$1"; shift || true
  local url="${BASE_URL}${path}"
  local headers_file=$(mktemp)

  local h=(
    -sS -D "$headers_file" -H "Accept: application/json"
    -H "Content-Type: application/json"
    -H "Cookie: ${COOKIE_STR}"
    -H "X-Request-Id: ${REQUEST_ID}"
  )
  if [[ -n "$idem" ]]; then h+=( -H "Idempotency-Key: ${idem}" ); fi

  local body_args=()
  if [[ "$method" != "GET" && -n "$data" ]]; then body_args=( --data "$data" ); fi

  local http_code
  set +e
  local resp=$(curl -X "$method" "${h[@]}" "${url}" ${body_args[@]} -w '\n%{http_code}' )
  local status=$?
  set -e
  if [[ $status -ne 0 ]]; then echo "[E2E] curl failed for $method $path" >&2; rm -f "$headers_file"; return 99; fi

  http_code=$(printf "%s" "$resp" | tail -n1)
  local json=$(printf "%s" "$resp" | sed '$d')
  echo "$json" | pp
  echo "---HEADERS---"
  grep -i -E '^(x-request-id|server-timing|x-ratelimit|retry-after|etag):' "$headers_file" || true
  echo "---STATUS---"
  echo "$http_code"
  rm -f "$headers_file"
}

check_health() {
  echo "[E2E] Health checks via /go/* ..."
  curl -sS "${BASE_URL}/go/health" -H "Cookie: ${COOKIE_STR}" >/dev/null || true
  curl -sS "${BASE_URL}/go/ready"  -H "Cookie: ${COOKIE_STR}" >/dev/null || true
  curl -sS "${BASE_URL}/go/live"   -H "Cookie: ${COOKIE_STR}" >/dev/null || true
  echo "[E2E] Health calls sent."
}

siterank_flow() {
  echo "[E2E] ==== SITERANK (precheck → execute → duplicate) ===="
  local body='{"domains":["example.com","example.net"]}'
  echo "[E2E] Precheck /go/api/v1/siterank/batch:check"
  local out
  out=$(curl_json POST "/go/api/v1/siterank/batch:check" "$body" "") || true
  local code=$(printf "%s" "$out" | tail -n1)
  if [[ "$code" == "401" ]]; then echo "[E2E] Unauthorized. Please provide authenticated COOKIE." >&2; exit 1; fi
  if [[ "$code" != "200" ]]; then echo "[E2E] Precheck failed with HTTP $code" >&2; fi

  echo "[E2E] Get balance (before) /go/api/v1/tokens/balance"
  curl_json GET "/go/api/v1/tokens/balance" "" "" || true

  local idem=$(uuid_like)
  echo "[E2E] Execute /go/api/v1/siterank/batch:execute (Idempotency-Key=$idem)"
  out=$(curl_json POST "/go/api/v1/siterank/batch:execute" "$body" "$idem") || true
  code=$(printf "%s" "$out" | tail -n1)
  if [[ "$code" != "200" ]]; then echo "[E2E] Execute failed with HTTP $code" >&2; fi

  echo "[E2E] Execute again with same Idempotency-Key (expect duplicate)"
  curl_json POST "/go/api/v1/siterank/batch:execute" "$body" "$idem" || true

  echo "[E2E] Get balance (after) /go/api/v1/tokens/balance"
  curl_json GET "/go/api/v1/tokens/balance" "" "" || true
}

batchopen_flow() {
  echo "[E2E] ==== BATCHOPEN (precheck → execute) ===="
  local body='{"urls":["https://example.com","https://example.net"],"cycleCount":1,"accessMode":"http"}'
  echo "[E2E] Precheck /go/api/v1/batchopen/silent:check"
  curl_json POST "/go/api/v1/batchopen/silent:check" "$body" "" || true
  local idem=$(uuid_like)
  echo "[E2E] Execute /go/api/v1/batchopen/silent:execute (Idempotency-Key=$idem)"
  curl_json POST "/go/api/v1/batchopen/silent:execute" "$body" "$idem" || true
}

adscenter_flow() {
  echo "[E2E] ==== ADSCENTER (precheck → execute) ===="
  local body='{"name":"e2e_adscenter","affiliate_links":["https://aff.example/link1"],"adspower_profile":"profile-1","google_ads_account":"acc-001"}'
  echo "[E2E] Precheck /go/api/v1/adscenter/link:update:check"
  curl_json POST "/go/api/v1/adscenter/link:update:check" "$body" "" || true
  local idem=$(uuid_like)
  echo "[E2E] Execute /go/api/v1/adscenter/link:update:execute (Idempotency-Key=$idem)"
  curl_json POST "/go/api/v1/adscenter/link:update:execute" "$body" "$idem" || true
}

echo "[E2E] BASE_URL=${BASE_URL} FEATURE=${FEATURE} REQUEST_ID=${REQUEST_ID}"
check_health || true

case "$FEATURE" in
  siterank)  siterank_flow ;;
  batchopen) batchopen_flow ;;
  adscenter) adscenter_flow ;;
  all) siterank_flow; batchopen_flow; adscenter_flow ;;
  *) echo "Unknown FEATURE: $FEATURE" >&2; exit 1 ;;
esac

echo "[E2E] Done. Review headers above (X-Request-Id, Server-Timing, X-RateLimit-*) and status codes."

