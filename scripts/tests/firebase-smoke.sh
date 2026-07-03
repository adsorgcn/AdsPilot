#!/usr/bin/env bash
set -euo pipefail

# Smoke test Firebase/Firestore via REST API using ADC token.
# Requires: gcloud auth application-default login

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-}}}"
DB_ID="${FIRESTORE_DATABASE_ID:-${NEXT_PUBLIC_FIRESTORE_DB_ID:-\(default\)}}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "[firebase-smoke] ERROR: Set GOOGLE_CLOUD_PROJECT or NEXT_PUBLIC_FIREBASE_PROJECT_ID" >&2
  exit 1
fi

ACCESS_TOKEN=$(gcloud auth application-default print-access-token)
if [[ -z "${ACCESS_TOKEN}" ]]; then
  echo "[firebase-smoke] ERROR: No ADC token; run 'gcloud auth application-default login'" >&2
  exit 2
fi

URL="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DB_ID}/documents/blog_posts?pageSize=1"
echo "[firebase-smoke] GET ${URL}"
HTTP_CODE=$(curl -s -o /tmp/fs.json -w "%{http_code}" -H "Authorization: Bearer ${ACCESS_TOKEN}" "${URL}")
if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "[firebase-smoke] ERROR: Firestore list failed: HTTP ${HTTP_CODE}" >&2
  cat /tmp/fs.json || true
  exit 3
fi
echo "[firebase-smoke] Firestore access OK"
cat /tmp/fs.json | head -c 400 || true
echo
echo "[firebase-smoke] Done"
