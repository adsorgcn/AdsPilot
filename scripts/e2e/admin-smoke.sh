#!/usr/bin/env bash
set -euo pipefail

# Simple admin console smoke tests via curl
# Env:
#  BASE_URL (default http://localhost:3000)
#  ADMIN_BEARER (required) - Bearer token for admin JWT

BASE_URL=${BASE_URL:-http://localhost:3000}
AUTH_HEADER="Authorization: Bearer ${ADMIN_BEARER:-}"

if [ -z "${ADMIN_BEARER:-}" ]; then
  echo "ERROR: ADMIN_BEARER env var is required (admin JWT)" >&2
  exit 1
fi

ok=0; fail=0
hit() {
  local method=$1 path=$2 body=${3:-}
  echo "=> ${method} ${path}"
  if [ -n "$body" ]; then
    resp=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "$AUTH_HEADER" -H 'content-type: application/json' -d "$body")
  else
    resp=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "$AUTH_HEADER")
  fi
  if [ "$resp" = "200" ]; then echo "  OK ($resp)"; ok=$((ok+1)); else echo "  FAIL ($resp)"; fail=$((fail+1)); fi
}

echo "Running admin smoke against $BASE_URL"

# Health
hit GET "/api/health"

# System config read
hit GET "/ops/api/v1/console/system/config"

# Users page
hit GET "/ops/api/v1/console/users?page=1&pageSize=1"

# Plans
hit GET "/ops/api/v1/console/plans"

# Subscriptions list (first user)
hit GET "/ops/api/v1/console/subscriptions?page=1&pageSize=1"

# Token transactions
hit GET "/ops/api/v1/console/tokens/transactions?page=1&pageSize=1"

# API management endpoints & keys
hit GET "/ops/api/v1/console/api-management/endpoints"
hit GET "/ops/api/v1/console/api-management/keys"

# Invitation/Checkin stats
hit GET "/ops/api/v1/console/invitations/stats"
hit GET "/ops/api/v1/console/checkins/stats"

echo "Summary: OK=$ok FAIL=$fail"
if [ "$fail" -gt 0 ]; then exit 2; fi
exit 0

