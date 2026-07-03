#!/usr/bin/env bash
set -euo pipefail

# End-to-end full loop: Offer -> Siterank -> Diagnose/Plan/Validate/Submit -> Notifications snapshot
# Usage:
#   GATEWAY=https://www.urlchecker.dev AUTH="Bearer <id_token>" ./scripts/ops/e2e-full-loop.sh

GATEWAY=${GATEWAY:-}
AUTH=${AUTH:-}
OFFER_URL=${OFFER_URL:-"https://example.com"}
COUNTRY=${COUNTRY:-"US"}

if [[ -z "$GATEWAY" || -z "$AUTH" ]]; then
  echo "GATEWAY and AUTH required" >&2
  exit 2
fi

hdr=( -H "Authorization: ${AUTH}" -H 'Content-Type: application/json' )
ts() { date +%s%3N; }
step() { echo -e "\n=== $* ==="; }

step "Create Offer"
offerName="e2e-$(date +%H%M%S)"
createBody=$(jq -n --arg name "$offerName" --arg url "$OFFER_URL" '{ name: $name, originalUrl: $url }')
offer=$(curl -fsS -m 20 "${GATEWAY}/api/v1/offers" -X POST ${hdr[@]} -d "$createBody")
offerId=$(echo "$offer" | jq -r '.id // .offerId // empty')
[[ -n "$offerId" ]] || { echo "Create offer failed: $offer" >&2; exit 1; }
echo "Offer: $offerId"

step "Siterank analyze"
srBody=$(jq -n --arg id "$offerId" --arg c "$COUNTRY" '{ offerId: $id, country: $c }')
curl -fsS -m 20 "${GATEWAY}/api/v1/siterank/analyze" -X POST -H 'Content-Type: application/json' -d "$srBody" | jq -r '.status // .ok // empty' || true

sleep 2
echo "Fetch latest analysis"
curl -fsS -m 20 "${GATEWAY}/api/v1/siterank/${offerId}" | jq -c '.' || true

step "Adscenter diagnose -> plan -> validate -> submit"
metrics=$(curl -fsS -m 20 ${hdr[@]} "${GATEWAY}/api/v1/adscenter/diagnose/metrics?accountId=stub")
plan=$(curl -fsS -m 20 ${hdr[@]} -X POST -d "$(jq -n --argjson m "$metrics" '{metrics:$m}')" "${GATEWAY}/api/v1/adscenter/diagnose/plan" | jq -c '.plan')
[[ "$plan" != "null" && -n "$plan" ]] || { echo "Plan generation failed" >&2; exit 1; }
val=$(curl -fsS -m 20 ${hdr[@]} -X POST -d "$plan" "${GATEWAY}/api/v1/adscenter/bulk-actions/validate")
ok=$(echo "$val" | jq -r '.ok // false')
echo "Validate ok: $ok"
[[ "$ok" == "true" ]] || echo "$val" | jq -c '.'
submit=$(curl -fsS -m 20 ${hdr[@]} -X POST -d "$plan" "${GATEWAY}/api/v1/adscenter/bulk-actions")
echo "$submit" | jq -c '.'

step "Notifications snapshot"
curl -fsS -m 20 ${hdr[@]} "${GATEWAY}/api/v1/notifications/recent?limit=10" | jq -c '.items|.[:5]'

echo "Done."

