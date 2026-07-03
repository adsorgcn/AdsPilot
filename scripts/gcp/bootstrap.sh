#!/usr/bin/env bash
set -euo pipefail

# Bootstrap Google Cloud resources required by Google-Monetize.
# - Creates Artifact Registry repo if missing
# - Creates Pub/Sub topic if missing
# - Ensures Secret Manager secret exists (optionally add version from FALLBACK_DATABASE_URL)

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
REGION="${REGION:-asia-northeast1}"
REPO="${REPO:-gm-services}"
PUBSUB_TOPIC_ID="${PUBSUB_TOPIC_ID:-domain-events}"
DATABASE_URL_SECRET_NAME="${DATABASE_URL_SECRET_NAME:-}"
FALLBACK_DATABASE_URL="${FALLBACK_DATABASE_URL:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "[bootstrap] ERROR: GOOGLE_CLOUD_PROJECT/PROJECT_ID is required" >&2
  exit 1
fi

echo "[bootstrap] Project: ${PROJECT_ID} | Region: ${REGION}"
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "[bootstrap] Ensuring Artifact Registry repo: ${REPO}"
if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Google-Monetize services Docker repository"
else
  echo "[bootstrap] Artifact Registry repo exists"
fi

echo "[bootstrap] Ensuring Pub/Sub topic: ${PUBSUB_TOPIC_ID}"
if ! gcloud pubsub topics describe "${PUBSUB_TOPIC_ID}" >/dev/null 2>&1; then
  gcloud pubsub topics create "${PUBSUB_TOPIC_ID}"
else
  echo "[bootstrap] Pub/Sub topic exists"
fi

if [[ -n "${DATABASE_URL_SECRET_NAME}" ]]; then
  # Extract secret id from full resource path: projects/<id>/secrets/<name>/versions/latest
  SECRET_ID="${DATABASE_URL_SECRET_NAME}"
  SECRET_ID=${SECRET_ID#projects/*/secrets/}
  SECRET_ID=${SECRET_ID%%/versions/*}
  if [[ -z "${SECRET_ID}" || "${SECRET_ID}" == "${DATABASE_URL_SECRET_NAME}" ]]; then
    echo "[bootstrap] WARN: Failed to parse SECRET_ID from DATABASE_URL_SECRET_NAME='${DATABASE_URL_SECRET_NAME}'"
  else
    echo "[bootstrap] Ensuring Secret: ${SECRET_ID}"
    if ! gcloud secrets describe "${SECRET_ID}" >/dev/null 2>&1; then
      gcloud secrets create "${SECRET_ID}" --replication-policy=automatic
    else
      echo "[bootstrap] Secret exists"
    fi
    if [[ -n "${FALLBACK_DATABASE_URL}" ]]; then
      echo "[bootstrap] Adding secret version from FALLBACK_DATABASE_URL"
      printf "%s" "${FALLBACK_DATABASE_URL}" | gcloud secrets versions add "${SECRET_ID}" --data-file=- >/dev/null
    else
      echo "[bootstrap] No FALLBACK_DATABASE_URL provided; skip adding version"
    fi
  fi
else
  echo "[bootstrap] NOTE: DATABASE_URL_SECRET_NAME not provided; skipped Secret creation"
fi

echo "[bootstrap] Done"

