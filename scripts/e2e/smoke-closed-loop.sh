#!/usr/bin/env bash
set -euo pipefail

# Minimal closed-loop smoke for frontend BFF routes.
# Prerequisites:
#  - Environment has NEXT app running and accessible via BASE_URL
#  - A valid Firebase ID token placed in cookie header (see LOGIN section)

BASE_URL=${BASE_URL:-"http://127.0.0.1:3000"}
FIREBASE_TOKEN=${FIREBASE_TOKEN:-""}
COOKIE_HEADER="Cookie: Firebase-Token=${FIREBASE_TOKEN}"

fail() { echo "[FAIL] $*" >&2; exit 1; }
step() { echo "[STEP] $*"; }

if [[ -z "$FIREBASE_TOKEN" ]]; then
  cat <<EOF
[INFO] FIREBASE_TOKEN is empty. You can log in via browser then export it:
  export FIREBASE_TOKEN=<paste_from_browser_cookie>
EOF
fi

step "Create offer"
OFFER_NAME="e2e-$(date +%s)"
OFFER_URL="https://example.com"
# Prefer robust /go path to bypass gateway quirks
CREATE=$(curl -sS -w "\n%{http_code}" -X POST "$BASE_URL/go/api/v1/offers" -H "$COOKIE_HEADER" -H 'content-type: application/json' \
  --data "{\"name\":\"$OFFER_NAME\",\"originalUrl\":\"$OFFER_URL\"}") || fail "create offer"
# Parse offer id from common keys: OfferID/offerId/id
OFFER_ID=$(echo "$CREATE" | head -n1 | jq -r '(.OfferID // .offerId // .id // empty)')
[[ -n "$OFFER_ID" && "$OFFER_ID" != "null" ]] || fail "parse offer id"
echo "offerId=$OFFER_ID"

step "Analyze (Siterank)"
ANALYZE=$(curl -sS -X POST "$BASE_URL/api/siterank/analyze" -H "$COOKIE_HEADER" -H 'content-type: application/json' \
  --data "{\"offerId\":\"$OFFER_ID\"}") || fail "siterank analyze"
echo "$ANALYZE" | jq '.id // empty' >/dev/null || true

step "Get latest Siterank by offer"
curl -sS "$BASE_URL/api/siterank/$OFFER_ID" -H "$COOKIE_HEADER" | jq '.status // empty, .result? // empty' >/dev/null || true

step "Simulate (safe mode)"
TASK_JSON=$(curl -sS -X POST "$BASE_URL/api/batchopen/tasks" -H "$COOKIE_HEADER" -H 'content-type: application/json' \
  --data "{\"offerId\":\"$OFFER_ID\",\"mode\":\"safe\",\"dailyLimit\":10,\"country\":\"US\"}") || echo "{}"
echo "$TASK_JSON" | jq . > /dev/null || true
TASK_ID=$(echo "$TASK_JSON" | sed -n 's/.*"\(taskId\|id\)"\s*:\s*"\([^"]*\)".*/\2/p')
if [[ -n "$TASK_ID" ]]; then
  step "Check live progress (SSE)"
  curl -sS -m 3 -N "$BASE_URL/api/batchopen/tasks/$TASK_ID/live" -H "$COOKIE_HEADER" >/dev/null || echo "[WARN] live sse not available"
fi

step "Ads Preflight (validate-only)"
PREF=$(curl -sS -X POST "$BASE_URL/api/adscenter/preflight" -H "$COOKIE_HEADER" -H 'content-type: application/json' \
  --data "{\"offerId\":\"$OFFER_ID\"}") || PREF='{}'
echo "$PREF" | jq '.summary // empty, .checks?|length' >/dev/null || true
# Optional: if checks exist, assert basic structure (non-fatal)
if echo "$PREF" | jq -e '.checks|type=="array" and (.checks|length)>0' >/dev/null 2>&1; then
  echo "$PREF" | jq -e '([.checks[]|has("severity") and has("code")]|all) as $ok | {checks_ok: $ok}' >/dev/null 2>&1 || echo "[WARN] checks missing severity/code"
fi

step "Bulk validate plan"
PLAN='{"validateOnly":true,"actions":[{"type":"ADJUST_CPC","filter":{"offerId":"'$OFFER_ID'"},"params":{"percent":10}}]}'
VALID=$(curl -sS -X POST "$BASE_URL/api/adscenter/bulk-actions/validate" -H "$COOKIE_HEADER" -H 'content-type: application/json' -d "$PLAN") || VALID='{}'
echo "$VALID" | jq '.ok // empty, .errors?|length' >/dev/null || true
# Optional check: if .ok exists, expect true; else if .errors exists, expect length>=0 (non-fatal)
if echo "$VALID" | jq -e 'has("ok")' >/dev/null 2>&1; then
  echo "$VALID" | jq -e '.ok==true' >/dev/null 2>&1 || echo "[WARN] bulk validate ok!=true"
fi

step "Bulk execute plan (may be queued)"
PLAN2='{"validateOnly":false,"actions":[{"type":"ADJUST_CPC","filter":{"offerId":"'$OFFER_ID'"},"params":{"percent":10}}]}'
BULK_EXEC=$(curl -sS -X POST "$BASE_URL/api/adscenter/bulk-actions" -H "$COOKIE_HEADER" -H 'content-type: application/json' -d "$PLAN2") || BULK_EXEC='{}'
echo "$BULK_EXEC" | jq '.operationId // empty' >/dev/null || true
OP_ID=$(echo "$BULK_EXEC" | sed -n 's/.*"\(operationId\|id\)"\s*:\s*"\([^"]*\)".*/\2/p')
if [[ -n "$OP_ID" ]]; then
  step "Bulk status"
  STAT=$(curl -sS "$BASE_URL/api/adscenter/bulk-actions/$OP_ID" -H "$COOKIE_HEADER") || STAT='{}'
  echo "$STAT" | jq '.status // .state // empty' >/dev/null || echo "[WARN] bulk status missing"
  step "Bulk audits"
  curl -sS "$BASE_URL/api/adscenter/bulk-actions/$OP_ID/audits" -H "$COOKIE_HEADER" | jq '.items?|length // length // empty' >/dev/null || true
fi

step "Optional checks structure (if present)"
echo "$PREF" | jq 'if (.checks|type=="array" and (.checks|length)>0) then {code: .checks[0].code, severity: .checks[0].severity} else {} end' >/dev/null || true

step "Notifications endpoints (non-fatal)"
curl -sS "$BASE_URL/api/notifications/unread-count" -H "$COOKIE_HEADER" | jq '.count // empty' >/dev/null || true
curl -sS "$BASE_URL/api/notifications/recent" -H "$COOKIE_HEADER" | jq '.items?|length // length // empty' >/dev/null || true

step "Check balance"
curl -sS "$BASE_URL/api/billing/tokens/balance" -H "$COOKIE_HEADER" | jq . > /dev/null || fail "balance"

echo "[OK] Closed-loop smoke passed (with stubs where applicable)"
