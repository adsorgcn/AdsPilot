#!/usr/bin/env bash
set -euo pipefail

# Smoke script: submit a minimal plan with ROTATE_LINK validate-only, then trigger execute-next once.
# Env:
#   BASE_URL, USER_ID (for X-User-Id), OP_ID_OUT (optional output file)

BASE_URL=${BASE_URL:?BASE_URL required}
USER_ID=${USER_ID:-tester}

PLAN='{
  "validateOnly": false,
  "actions": [
    {
      "type": "ROTATE_LINK",
      "params": {
        "adResourceNames": ["customers/123/adGroupAds/456~789"],
        "links": ["https://example.com/lp?a=1"]
      }
    }
  ]
}'

echo "[submit] plan"
RESP=$(curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $USER_ID" \
  -d "$PLAN" \
  "$BASE_URL/api/v1/adscenter/bulk-actions")
echo "$RESP" | jq .
OP_ID=$(echo "$RESP" | jq -r .operationId)
if [[ -z "$OP_ID" || "$OP_ID" == "null" ]]; then echo "no operationId"; exit 1; fi
echo "[op] $OP_ID"

echo "[execute-next]"
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $USER_ID" \
  "$BASE_URL/api/v1/adscenter/bulk-actions/$OP_ID/execute-next" | jq .

