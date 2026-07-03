#!/usr/bin/env bash
set -euo pipefail

# Create a Cloud Monitoring alerting policy using MQL for 5xx error rate on a Cloud Run service.
# Computes 5-minute error ratio and alerts if above threshold.
#
# Env:
#   PROJECT_ID (default: GOOGLE_CLOUD_PROJECT)
#   SERVICE (required)
#   THRESHOLD (default: 0.01)  i.e., 1%
#   DURATION (default: 300s)   MQL condition duration

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}"
SERVICE="${SERVICE:-}"
THRESHOLD="${THRESHOLD:-0.01}"
DURATION="${DURATION:-300s}"

if [[ -z "$SERVICE" ]]; then
  echo "Usage: SERVICE=<cloud-run-service> [THRESHOLD=0.01] [PROJECT_ID=..] $0" >&2
  exit 2
fi

ACCESS_TOKEN=$(gcloud auth print-access-token)
NAME="projects/${PROJECT_ID}/alertPolicies"

read -r -d '' QUERY <<MQL || true
fetch cloud_run_revision
| metric 'run.googleapis.com/request_count'
| filter (resource.service_name == '${SERVICE}')
| group_by 5m, [total: sum(value.request_count)]
| join (
    fetch cloud_run_revision
    | metric 'run.googleapis.com/request_count'
    | filter (resource.service_name == '${SERVICE}')
    | filter (metric.response_code_class == '5xx')
    | group_by 5m, [err: sum(value.request_count)]
  )
| ratio = err / total
| condition ratio > ${THRESHOLD}
MQL

DISPLAY="run ${SERVICE} 5xx error rate > $(printf '%.2f' $(echo "$THRESHOLD * 100" | bc -l))%"
esc_query=$(printf '%s' "$QUERY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
read -r -d '' BODY <<JSON || true
{
  "displayName": "${DISPLAY}",
  "combiner": "OR",
  "enabled": true,
  "conditions": [
    {
      "displayName": "5xx error ratio (${SERVICE})",
      "conditionMonitoringQueryLanguage": {
        "query": ${esc_query},
        "duration": "${DURATION}",
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
