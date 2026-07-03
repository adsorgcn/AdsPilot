#!/usr/bin/env bash
set -euo pipefail

# Update Cloud Run service environment variables (non-secret).
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 SERVICE=adscenter \
#   ./deployments/scripts/set-env-vars.sh KEY1=VAL1 KEY2=VAL2 ...

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:?REGION required}
SERVICE=${SERVICE:?SERVICE required}

if [[ $# -lt 1 ]]; then
  echo "usage: PROJECT_ID=... REGION=... SERVICE=... $0 KEY=VAL [KEY=VAL ...]" >&2
  exit 2
fi

JOINED=$(IFS=, ; echo "$*")
echo "[env] update $SERVICE: $JOINED"
gcloud run services update "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" \
  --update-env-vars "$JOINED"
echo "[DONE] env updated for $SERVICE"

