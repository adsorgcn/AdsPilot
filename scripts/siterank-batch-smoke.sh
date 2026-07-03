#!/usr/bin/env bash
set -euo pipefail

# Simple smoke script for SiteRank batch check/execute via BFF (/go)
# Usage:
#   BASE=http://localhost:3000 AUTH="Bearer <ijwt or session>" ./scripts/siterank-batch-smoke.sh domain1.com domain2.com

BASE_URL=${BASE:-http://localhost:3000}
AUTHZ=${AUTH:-}

if [ "$#" -lt 1 ]; then
  echo "Usage: BASE=<url> AUTH='Bearer ...' $0 domain1.com [domain2.com ...]" >&2
  exit 1
fi

DOMAINS=("$@")
BODY=$(jq -nc --argjson arr "$(printf '%s\n' "${DOMAINS[@]}" | jq -R . | jq -s .)" '{domains: $arr}')

echo "[check] ${#DOMAINS[@]} domains"
curl -fsS -X POST \
  -H 'content-type: application/json' \
  ${AUTHZ:+-H "authorization: ${AUTHZ}"} \
  -d "${BODY}" \
  "${BASE_URL}/go/api/v1/siterank/batch:check" | jq .

echo "[execute]"
curl -fsS -X POST \
  -H 'content-type: application/json' \
  ${AUTHZ:+-H "authorization: ${AUTHZ}"} \
  -H "Idempotency-Key: $(uuidgen || date +%s%N)" \
  -d "${BODY}" \
  "${BASE_URL}/go/api/v1/siterank/batch:execute" | jq .

