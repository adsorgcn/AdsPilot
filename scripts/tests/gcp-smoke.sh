#!/usr/bin/env bash
set -euo pipefail

# Smoke test GCP integrations:
# - Secret Manager access (DATABASE_URL)
# - Pub/Sub publish

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
PUBSUB_TOPIC_ID="${PUBSUB_TOPIC_ID:-domain-events}"
DATABASE_URL_SECRET_NAME="${DATABASE_URL_SECRET_NAME:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "[gcp-smoke] ERROR: GOOGLE_CLOUD_PROJECT/PROJECT_ID is required" >&2
  exit 1
fi
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "[gcp-smoke] Checking Secret Manager access: ${DATABASE_URL_SECRET_NAME:-<none>}"
if [[ -n "${DATABASE_URL_SECRET_NAME}" ]]; then
  if gcloud secrets versions access latest --secret="${DATABASE_URL_SECRET_NAME#projects/*/secrets/}" >/dev/null 2>&1; then
    echo "[gcp-smoke] Secret access OK"
  else
    echo "[gcp-smoke] ERROR: Cannot access secret version" >&2
    exit 2
  fi
else
  echo "[gcp-smoke] WARN: DATABASE_URL_SECRET_NAME not set; skipping secret access test"
fi

echo "[gcp-smoke] Publishing a test message to Pub/Sub: ${PUBSUB_TOPIC_ID}"
gcloud pubsub topics publish "${PUBSUB_TOPIC_ID}" --message="gm-smoke-test-$(date +%s)" >/dev/null
echo "[gcp-smoke] Pub/Sub publish OK"

echo "[gcp-smoke] Done"

