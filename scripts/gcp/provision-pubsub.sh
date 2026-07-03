#!/usr/bin/env bash
set -euo pipefail

# Provision Pub/Sub topic and subscriptions for a single-project multi-environment setup.
# Usage: PROJECT=${GCP_PROJECT_ID} REGION=asia-northeast1 STACK=prod \
#        SERVICES="offer billing adscenter batchopen siterank notifications" ./scripts/gcp/provision-pubsub.sh

: "${PROJECT:?PROJECT required}"
: "${STACK:?STACK required}"
SERVICES=${SERVICES:-"offer billing adscenter batchopen siterank notifications"}
TOPIC="domain-events-${STACK}"

echo "[INFO] Using project: ${PROJECT}, stack: ${STACK}"
gcloud config set project "${PROJECT}" >/dev/null

if ! gcloud pubsub topics describe "${TOPIC}" >/dev/null 2>&1; then
  echo "[INFO] Creating topic: ${TOPIC}"
  gcloud pubsub topics create "${TOPIC}"
else
  echo "[INFO] Topic exists: ${TOPIC}"
fi

for svc in ${SERVICES}; do
  sub="${svc}-sub-${STACK}"
  if ! gcloud pubsub subscriptions describe "${sub}" >/dev/null 2>&1; then
    echo "[INFO] Creating subscription: ${sub} -> ${TOPIC}"
    gcloud pubsub subscriptions create "${sub}" --topic="${TOPIC}"
  else
    echo "[INFO] Subscription exists: ${sub}"
  fi
done

echo "[DONE] Pub/Sub topic and subscriptions are ready."
