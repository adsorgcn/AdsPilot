#!/usr/bin/env bash
set -euo pipefail

# Check effective plan limits and daily quota for the current user
# Usage:
#   BASE=http://localhost:8080 AUTH="Bearer <token>" ./scripts/ops/check-limits.sh

BASE=${BASE:-"http://localhost:8080"}
AUTHHDR=${AUTH:-"Bearer dummy"}
curl -sf -H "Authorization: ${AUTHHDR}" "${BASE}/api/v1/adscenter/limits/me" | jq .

