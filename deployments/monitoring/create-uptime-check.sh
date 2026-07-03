#!/usr/bin/env bash
set -euo pipefail

# Create an uptime check for API Gateway /readyz via Monitoring API.
# Requires: gcloud auth application-default login (or service account creds), Monitoring API enabled.

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}"
REGION="${REGION:-asia-northeast1}"
HOSTNAME="${HOSTNAME:-}"

if [[ -z "$HOSTNAME" ]]; then
  echo "[uptime] Resolving API Gateway hostname ..."
  HOSTNAME=$(gcloud api-gateway gateways describe gm-gw --location="$REGION" --format='value(defaultHostname)' 2>/dev/null || true)
fi

if [[ -z "$HOSTNAME" ]]; then
  echo "ERROR: HOSTNAME not provided and could not resolve gm-gw. Set HOSTNAME explicitly." >&2
  exit 1
fi

ACCESS_TOKEN=$(gcloud auth print-access-token)
NAME="projects/${PROJECT_ID}/uptimeCheckConfigs"
DISPLAY_NAME="gateway-readyz"
BODY=$(cat <<JSON
{
  "displayName": "${DISPLAY_NAME}",
  "monitoredResource": { "type": "uptime_url", "labels": { "host": "${HOSTNAME}", "project_id": "${PROJECT_ID}" } },
  "httpCheck": { "useSsl": true, "path": "/readyz", "port": 443 },
  "timeout": "10s",
  "period": "300s"
}
JSON
)

echo "[uptime] Creating uptime check for https://${HOSTNAME}/readyz ..."
curl -sS -X POST -H "Authorization: Bearer ${ACCESS_TOKEN}" -H "Content-Type: application/json" \
  "https://monitoring.googleapis.com/v3/${NAME}" -d "${BODY}" | sed -e 's/.*/[api] &/' || true

echo "[uptime] Done. Check Monitoring > Uptime checks in Console."

