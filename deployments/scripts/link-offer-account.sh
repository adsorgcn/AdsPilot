#!/usr/bin/env bash
set -euo pipefail

# Link a Google Ads account to an offer via offer service API.
# Usage:
#   BASE_URL=https://offer-preview-xxxx-ane1.run.app \
#   OFFER_ID=... USER_ID=... ACCOUNT_ID=... ./deployments/scripts/link-offer-account.sh

BASE_URL=${BASE_URL:-}
OFFER_ID=${OFFER_ID:-}
USER_ID=${USER_ID:-}
ACCOUNT_ID=${ACCOUNT_ID:-}

if [[ -z "$BASE_URL" || -z "$OFFER_ID" || -z "$USER_ID" || -z "$ACCOUNT_ID" ]]; then
  echo "Usage: BASE_URL=<offer_url> OFFER_ID=<id> USER_ID=<uid> ACCOUNT_ID=<cid> $0" >&2
  exit 2
fi

URL="${BASE_URL%/}/api/v1/offers/${OFFER_ID}/accounts"
echo "[POST] $URL (X-User-Id=$USER_ID)"
curl -sS -X POST "$URL" \
  -H "X-User-Id: $USER_ID" -H 'Content-Type: application/json' \
  -d "{\"accountId\":\"$ACCOUNT_ID\"}" | jq .

