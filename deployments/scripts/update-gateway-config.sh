#!/usr/bin/env bash
set -euo pipefail

# Wait until a Gateway becomes ACTIVE, then update it to target API config.
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 GATEWAY=gm-gw API=gm-api CONFIG=gm-v2-3 ./deployments/scripts/update-gateway-config.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:-asia-northeast1}
GATEWAY=${GATEWAY:-gm-gw}
API=${API:-gm-api}
CONFIG=${CONFIG:?CONFIG required}

gcloud config set project "$PROJECT_ID" >/dev/null

echo "[gw] Waiting for gateway $GATEWAY to be ACTIVE ..."
for i in {1..60}; do
  st=$(gcloud api-gateway gateways describe "$GATEWAY" --location="$REGION" --format='value(state)' || true)
  echo "  state=$st"
  if [[ "$st" == "ACTIVE" || "$st" == "FAILED" ]]; then
    break
  fi
  sleep 5
done

if [[ "$st" != "ACTIVE" ]]; then
  echo "[gw] Gateway not ACTIVE (state=$st); aborting update" >&2
  exit 1
fi

echo "[gw] Updating $GATEWAY to API $API config $CONFIG ..."
gcloud api-gateway gateways update "$GATEWAY" \
  --api="$API" \
  --api-config="$CONFIG" \
  --location="$REGION"

echo "[gw] Done"

