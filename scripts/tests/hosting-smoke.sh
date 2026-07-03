#!/usr/bin/env bash
set -euo pipefail

# Smoke test for Firebase Hosting deployed Next app
# Usage:
#   PROJECT_ID=${GCP_PROJECT_ID} ./scripts/tests/hosting-smoke.sh

PROJECT_ID=${PROJECT_ID:-}
if [[ -z "${PROJECT_ID}" ]]; then
  echo "[err] PROJECT_ID required (e.g., ${GCP_PROJECT_ID})" >&2
  exit 2
fi

BASE="https://${PROJECT_ID}.web.app"

echo "[hosting-smoke] Base: ${BASE}"

code=$(curl -s -o /tmp/hs_index.html -w "%{http_code}" "${BASE}/")
echo "[hosting-smoke] GET / -> ${code}"

code=$(curl -s -o /tmp/hs_ready.txt -w "%{http_code}" "${BASE}/api/go/readyz")
echo "[hosting-smoke] GET /api/go/readyz -> ${code}"

code=$(curl -s -o /tmp/hs_health.json -w "%{http_code}" "${BASE}/api/go/api/health")
echo "[hosting-smoke] GET /api/go/api/health -> ${code}"

echo "[hosting-smoke] Snippet of /api/go/api/health:"
head -c 400 /tmp/hs_health.json || true
echo
echo "[hosting-smoke] Done"

