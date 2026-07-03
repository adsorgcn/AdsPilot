#!/usr/bin/env bash
set -euo pipefail

# Create/update Monitoring alert policies for browser-exec.
# Requires: gcloud auth, roles/monitoring.editor.
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} ./deployments/monitoring/create-alerts-browser-exec.sh

PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "PROJECT_ID is required" >&2; exit 1
fi

cd "$(dirname "$0")"

echo "[alerts] creating capacity exhausted policy"
gcloud monitoring policies create \
  --project "$PROJECT_ID" \
  --policy-from-file alerts/browser-exec-capacity.json \
  >/dev/null && echo "[ok] capacity policy created"

echo "Done. You can attach notification channels in Cloud Console."

