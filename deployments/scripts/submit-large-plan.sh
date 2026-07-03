#!/usr/bin/env bash
set -euo pipefail

# Submit a large bulk plan to Adscenter and trigger execute-tick for smoke.
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
#   USER_ID=u_preview_demo MAX=40 \
#   deployments/scripts/submit-large-plan.sh

PROJECT_ID=${PROJECT_ID:-${GCP_PROJECT_ID}}
REGION=${REGION:-asia-northeast1}
USER_ID=${USER_ID:-u_preview_demo}
MAX=${MAX:-40}

ADS_URL=$(gcloud run services describe adscenter-preview --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')
if [[ -z "$ADS_URL" ]]; then echo "adscenter-preview not found" >&2; exit 2; fi

# Build large plan: mix ADJUST_BUDGET and ADJUST_CPC actions
actions='['
for ((i=0;i<MAX;i++)); do
  if (( i % 2 == 0 )); then
    actions+='{ "type":"ADJUST_BUDGET", "params": {"percent": 10} }'
  else
    actions+='{ "type":"ADJUST_CPC", "params": {"percent": 5} }'
  fi
  if (( i < MAX-1 )); then actions+=","; fi
done
actions+=']'

body=$(jq -n --argjson a "$actions" '{ validateOnly:false, actions:$a }')
echo "[submit] ${MAX} actions"
resp=$(curl -sS -X POST -H 'Content-Type: application/json' -H "X-User-Id: ${USER_ID}" -d "$body" "$ADS_URL/api/v1/adscenter/bulk-actions")
echo "$resp"

echo "[tick] execute shards"
curl -sS -X POST -H "X-User-Id: scheduler" "$ADS_URL/api/v1/adscenter/bulk-actions/execute-tick?max=5" | jq .

echo "[done]"

