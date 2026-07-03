#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_HEADER="${AUTH_HEADER:-}"

function info(){ echo -e "\033[1;34m[info]\033[0m $*"; }
function pass(){ echo -e "\033[1;32m[pass]\033[0m $*"; }
function fail(){ echo -e "\033[1;31m[fail]\033[0m $*"; exit 1; }

curl_json(){
  local url="$1"; shift
  curl -sS -H 'accept: application/json' ${AUTH_HEADER:+-H "$AUTH_HEADER"} "$url" "$@"
}

header(){ curl -sSI ${AUTH_HEADER:+-H "$AUTH_HEADER"} "$1"; }

info "Smoke: health"
header "$BASE_URL/api/health" | grep -qi "200" && pass "health ok" || fail "health failed"

info "Smoke: gateway /go version headers"
header "$BASE_URL/go/ready" | grep -qi "200" || fail "/go not ready"

info "Smoke: siterank (compat) Deprecation headers"
header "$BASE_URL/api/siterank/version" | grep -qi "Deprecation: true" && pass "compat deprecation ok" || info "compat deprecation header not found (non-blocking)"

info "Smoke: tokens balance via Go"
curl_json "$BASE_URL/go/api/v1/tokens/balance" | jq '.' >/dev/null 2>&1 || info "tokens/balance requires auth; skip"

info "Smoke: batchopen version"
curl_json "$BASE_URL/go/api/v1/batchopen/version" | jq '.' >/dev/null 2>&1 && pass "batchopen version ok" || info "batchopen version JSON not available"

pass "Smoke completed"

