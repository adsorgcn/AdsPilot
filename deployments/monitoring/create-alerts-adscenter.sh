#!/usr/bin/env bash
set -euo pipefail

# Create/update Monitoring alert policies for adscenter latency.
# Usage: PROJECT_ID=<id> ./deployments/monitoring/create-alerts-adscenter.sh

PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "PROJECT_ID is required" >&2; exit 1
fi

cd "$(dirname "$0")"

echo "[alerts] creating adscenter preflight p95 policy"
gcloud monitoring policies create \
  --project "$PROJECT_ID" \
  --policy-from-file alerts/adscenter-preflight-p95.json \
  >/dev/null && echo "[ok] adscenter p95 policy created"

echo "Done. Bind notification channels in Cloud Console if needed."

