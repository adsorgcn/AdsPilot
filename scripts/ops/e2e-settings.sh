#!/usr/bin/env bash
set -euo pipefail

# E2E smoke for settings endpoints via Gateway or direct service URL
# Usage examples:
#   HOST=gm-gw-xxxx.an.gateway.dev AUTH="Bearer <firebase_id_token>" ./scripts/ops/e2e-settings.sh
#   BASE=https://gm-gw-xxxx.an.gateway.dev AUTH="Bearer <token>" OFFER_ID=abc ./scripts/ops/e2e-settings.sh

HOST=${HOST:-}
BASE=${BASE:-}
AUTH=${AUTH:-}
OFFER_ID=${OFFER_ID:-}
ADMIN_AUTH=${ADMIN_AUTH:-}
NONADMIN_AUTH=${NONADMIN_AUTH:-}

if [[ -z "$BASE" && -n "$HOST" ]]; then BASE="https://${HOST}"; fi
if [[ -z "$BASE" ]]; then echo "BASE or HOST required" >&2; exit 2; fi
if [[ -z "$AUTH" ]]; then echo "AUTH (Bearer token) required" >&2; exit 2; fi

HDR=( -H "Authorization: ${AUTH}" -H 'Content-Type: application/json' )

echo "[e2e-settings] GET link-rotation"
LR_GET=$(curl -sf -m 20 ${HDR[@]} "$BASE/api/v1/adscenter/settings/link-rotation")
echo "$LR_GET" | jq . >/dev/null

echo "[e2e-settings] PUT link-rotation (minIntervalMinutes=45)"
PAYLOAD='{"enabled":true,"minIntervalMinutes":45,"maxPerDayPerOffer":24,"maxPerHourPerAccount":3,"rollbackOnError":true}'
curl -sf -m 30 ${HDR[@]} -X PUT -d "$PAYLOAD" "$BASE/api/v1/adscenter/settings/link-rotation" | jq . >/dev/null
LR_AGAIN=$(curl -sf -m 20 ${HDR[@]} "$BASE/api/v1/adscenter/settings/link-rotation")
echo "$LR_AGAIN" | jq .
test $(echo "$LR_AGAIN" | jq -r '.minIntervalMinutes') -eq 45 || { echo "[e2e] link-rotation minIntervalMinutes mismatch" >&2; exit 1; }

echo "[e2e-settings] GET notifications settings (user)"
NS_GET=$(curl -sf -m 20 ${HDR[@]} "$BASE/api/v1/console/notifications/settings?scope=user")
echo "$NS_GET" | jq . >/dev/null

echo "[e2e-settings] PUT notifications settings (minConfidence=0.7)"
NSET=$(jq -n '{enabled:true,minConfidence:0.7,throttlePerMinute:30,groupWindowSec:60,channels:{inApp:true,email:false,webhook:false}}')
curl -sf -m 30 ${HDR[@]} -X PUT -d "$NSET" "$BASE/api/v1/console/notifications/settings?scope=user" | jq . >/dev/null
NS_AGAIN=$(curl -sf -m 20 ${HDR[@]} "$BASE/api/v1/console/notifications/settings?scope=user")
echo "$NS_AGAIN" | jq .
test "$(echo "$NS_AGAIN" | jq -r '.minConfidence')" = "0.7" || { echo "[e2e] notifications minConfidence mismatch" >&2; exit 1; }

if [[ -n "$OFFER_ID" ]]; then
  echo "[e2e-settings] GET offer preferences ($OFFER_ID)"
  OP_GET=$(curl -sf -m 20 ${HDR[@]} "$BASE/api/v1/offers/${OFFER_ID}/preferences")
  echo "$OP_GET" | jq . >/dev/null
  echo "[e2e-settings] PUT offer preferences (auto on, thresholds)"
  OP=$(jq -n '{autoStatusEnabled:true,statusRules:{zeroPerfDays:6,roscDeclineDays:8}}')
  curl -sf -m 20 ${HDR[@]} -X PUT -d "$OP" "$BASE/api/v1/offers/${OFFER_ID}/preferences" | jq . >/dev/null
  OP_AGAIN=$(curl -sf -m 20 ${HDR[@]} "$BASE/api/v1/offers/${OFFER_ID}/preferences")
  echo "$OP_AGAIN" | jq .
  test $(echo "$OP_AGAIN" | jq -r '.statusRules.zeroPerfDays') -eq 6 || { echo "[e2e] offer zeroPerfDays mismatch" >&2; exit 1; }
  test $(echo "$OP_AGAIN" | jq -r '.statusRules.roscDeclineDays') -eq 8 || { echo "[e2e] offer roscDeclineDays mismatch" >&2; exit 1; }
fi

# Admin system-scope tests (optional)
if [[ -n "${ADMIN_AUTH}" ]]; then
  echo "[e2e-settings] PUT notifications settings (system scope, admin)"
  HDR_ADMIN=( -H "Authorization: ${ADMIN_AUTH}" -H 'Content-Type: application/json' )
  NSET_SYS=$(jq -n '{enabled:true,minConfidence:0.8,throttlePerMinute:20,groupWindowSec:120,channels:{inApp:true,email:true,webhook:false}}')
  curl -sf -m 30 ${HDR_ADMIN[@]} -X PUT -d "$NSET_SYS" "$BASE/api/v1/console/notifications/settings?scope=system" | jq . >/dev/null
  NS_SYS=$(curl -sf -m 20 ${HDR_ADMIN[@]} "$BASE/api/v1/console/notifications/settings?scope=system")
  echo "$NS_SYS" | jq .
  test "$(echo "$NS_SYS" | jq -r '.minConfidence')" = "0.8" || { echo "[e2e] system minConfidence mismatch" >&2; exit 1; }
fi

# Negative test (non-admin on system scope)
if [[ -n "${NONADMIN_AUTH}" ]]; then
  echo "[e2e-settings] NEGATIVE: non-admin PUT system scope (expect 403)"
  HDR_NON=( -H "Authorization: ${NONADMIN_AUTH}" -H 'Content-Type: application/json' )
  NSET_SYS_NEG=$(jq -n '{enabled:true,minConfidence:0.9,throttlePerMinute:10,groupWindowSec:60,channels:{inApp:true,email:false,webhook:false}}')
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 20 ${HDR_NON[@]} -X PUT -d "$NSET_SYS_NEG" "$BASE/api/v1/console/notifications/settings?scope=system" || true)
  if [[ "$CODE" == "200" || "$CODE" == "201" ]]; then
    echo "[e2e] expected non-admin 403, got $CODE" >&2; exit 1
  fi
fi

echo "[e2e-settings] OK"
