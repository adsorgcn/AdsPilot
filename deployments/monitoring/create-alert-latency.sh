#!/usr/bin/env bash
set -euo pipefail

# Create a Cloud Monitoring alerting policy for Cloud Run service P95 latency threshold.
# Uses metricThreshold with ALIGN_PERCENTILE_95 over 5m windows.
#
# Env:
#   PROJECT_ID (default: GOOGLE_CLOUD_PROJECT)
#   SERVICE (required)     e.g. siterank | batchopen | adscenter | billing
#   THRESHOLD_SEC (default: 10)  P95 latency threshold in seconds
#   WINDOW (default: 300s)       Alignment and evaluation window

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}"
SERVICE="${SERVICE:-}"
THRESHOLD_SEC="${THRESHOLD_SEC:-10}"
WINDOW="${WINDOW:-300s}"

if [[ -z "$SERVICE" ]]; then
  echo "Usage: SERVICE=<cloud-run-service> [THRESHOLD_SEC=10] [PROJECT_ID=..] $0" >&2
  exit 2
fi

ACCESS_TOKEN=$(gcloud auth print-access-token)
NAME="projects/${PROJECT_ID}/alertPolicies"

DISPLAY="run ${SERVICE} P95 latency > ${THRESHOLD_SEC}s"
read -r -d '' BODY <<JSON || true
{
  "displayName": "${DISPLAY}",
  "combiner": "OR",
  "enabled": true,
  "conditions": [
    {
      "displayName": "P95 latency threshold (${SERVICE})",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\" AND resource.labels.service_name=\"${SERVICE}\"",
        "aggregations": [
          { "alignmentPeriod": "${WINDOW}", "perSeriesAligner": "ALIGN_PERCENTILE_95" }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": ${THRESHOLD_SEC},
        "duration": "0s",
        "trigger": { "count": 1 }
      }
    }
  ]
}
JSON

echo "[alert] Creating policy: ${DISPLAY} in ${PROJECT_ID}"
curl -sS -X POST -H "Authorization: Bearer ${ACCESS_TOKEN}" -H "Content-Type: application/json" \
  "https://monitoring.googleapis.com/v3/${NAME}" -d "${BODY}" | sed -e 's/.*/[api] &/' || true

echo "[alert] Done. Check Monitoring > Alerting policies."

