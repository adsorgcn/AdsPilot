#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a baseline set of Cloud Run alerting policies (P95 latency + 5xx error rate) per service.
# Requires: gcloud auth + Monitoring API enabled. Idempotency is best-effort (creating duplicate policies with same displayName is avoided by Console).

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}"

declare -A LAT
LAT[siterank]="10"
LAT[adscenter]="0.8"
LAT[batchopen]="1.0"
LAT[billing]="0.8"
LAT[notifications]="0.5"
LAT[console]="0.5"

THRESHOLD_ERR="0.01" # 1%

DIR="$(cd "$(dirname "$0")" && pwd)"

for svc in "${!LAT[@]}"; do
  echo "[bootstrap] Creating latency alert for ${svc} (P95>${LAT[$svc]}s)"
  PROJECT_ID="$PROJECT_ID" SERVICE="$svc" THRESHOLD_SEC="${LAT[$svc]}" bash "$DIR/create-alert-latency.sh" || true
  echo "[bootstrap] Creating 5xx error-rate alert for ${svc} (>${THRESHOLD_ERR})"
  PROJECT_ID="$PROJECT_ID" SERVICE="$svc" THRESHOLD="$THRESHOLD_ERR" bash "$DIR/create-alert-error-rate.sh" || true
done

echo "[bootstrap] Done. Review policies in Monitoring > Alerting."

