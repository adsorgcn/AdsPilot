#!/usr/bin/env bash
set -euo pipefail

# Smoke aggregation for a single offer KPI via offer service endpoint.
# Usage:
#   BASE_URL=https://offer-preview-xxxxx-ane1.run.app \
#   OFFER_ID=... USER_ID=... ./deployments/scripts/aggregate-offer-kpi.sh

BASE_URL=${BASE_URL:-}
OFFER_ID=${OFFER_ID:-}
USER_ID=${USER_ID:-}
DATE=${DATE:-}

if [[ -z "$BASE_URL" || -z "$OFFER_ID" || -z "$USER_ID" ]]; then
  echo "Usage: BASE_URL=<offer_service_url> OFFER_ID=<id> USER_ID=<uid> [DATE=YYYY-MM-DD] $0" >&2
  exit 2
fi

URL="${BASE_URL%/}/api/v1/offers/${OFFER_ID}/kpi/aggregate"
if [[ -n "$DATE" ]]; then URL+="?date=${DATE}"; fi

echo "[POST] $URL (X-User-Id=$USER_ID)"
curl -sS -X POST "$URL" -H "X-User-Id: $USER_ID" -H 'Accept: application/json' | jq .

