#!/usr/bin/env bash
set -euo pipefail

# Bootstrap SLO alert policies for core Cloud Run services using existing helper scripts.
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 ./deployments/monitoring/bootstrap-slo-alerts.sh
# Env (optional defaults applied below):
#   LAT_SITERANK=2   LAT_BATCHOPEN=2  LAT_ADSCENTER=1.5  LAT_BILLING=1
#   ERR_THRESHOLD=0.02   # 2%

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}}
LAT_SITERANK=${LAT_SITERANK:-2}
LAT_BATCHOPEN=${LAT_BATCHOPEN:-2}
LAT_ADSCENTER=${LAT_ADSCENTER:-1.5}
LAT_BILLING=${LAT_BILLING:-1}
ERR_THRESHOLD=${ERR_THRESHOLD:-0.02}

echo "[monitor] project=${PROJECT_ID}"

pushd "$ROOT/monitoring" >/dev/null

echo "[latency] siterank P95>${LAT_SITERANK}s"
PROJECT_ID="$PROJECT_ID" SERVICE="siterank" THRESHOLD_SEC="$LAT_SITERANK" ./create-alert-latency.sh || true
echo "[latency] batchopen P95>${LAT_BATCHOPEN}s"
PROJECT_ID="$PROJECT_ID" SERVICE="batchopen" THRESHOLD_SEC="$LAT_BATCHOPEN" ./create-alert-latency.sh || true
echo "[latency] adscenter P95>${LAT_ADSCENTER}s"
PROJECT_ID="$PROJECT_ID" SERVICE="adscenter" THRESHOLD_SEC="$LAT_ADSCENTER" ./create-alert-latency.sh || true
echo "[latency] billing P95>${LAT_BILLING}s"
PROJECT_ID="$PROJECT_ID" SERVICE="billing" THRESHOLD_SEC="$LAT_BILLING" ./create-alert-latency.sh || true

for svc in siterank batchopen adscenter billing; do
  echo "[error-rate] ${svc} >$(echo "$ERR_THRESHOLD*100" | bc -l)%"
  PROJECT_ID="$PROJECT_ID" SERVICE="$svc" THRESHOLD="$ERR_THRESHOLD" ./create-alert-error-rate.sh || true
done

popd >/dev/null
echo "[DONE] SLO alert policies bootstrapped"

