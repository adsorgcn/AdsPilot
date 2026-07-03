#!/usr/bin/env bash
set -euo pipefail

SA_FILE="${SA_FILE:-secrets/gcp_codex_dev.json}"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID}}"
PUBSUB_TOPIC_ID="${PUBSUB_TOPIC_ID:-domain-events}"
DATABASE_URL_SECRET_NAME="${DATABASE_URL_SECRET_NAME:-projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest}"
FIRESTORE_DATABASE_ID="${FIRESTORE_DATABASE_ID:-(default)}"

token=$(SA_FILE="${SA_FILE}" SCOPES="https://www.googleapis.com/auth/cloud-platform" bash "$(dirname "$0")/sa-access-token.sh")

echo "[gcp-smoke] Accessing Secret: ${DATABASE_URL_SECRET_NAME}"
secret_body=$(curl -s -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
  -X POST "https://secretmanager.googleapis.com/v1/${DATABASE_URL_SECRET_NAME}:access")
if [[ "$(echo "$secret_body" | jq -r '.error.message // empty')" != "" ]]; then
  echo "[gcp-smoke] ERROR: $(echo "$secret_body" | jq -r '.error.message')" >&2
  exit 2
fi
echo "[gcp-smoke] Secret OK (payload redacted)"

echo "[gcp-smoke] Ensuring Pub/Sub topic: ${PUBSUB_TOPIC_ID}"
ensure_resp=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${token}" -X PUT \
  "https://pubsub.googleapis.com/v1/projects/${PROJECT_ID}/topics/${PUBSUB_TOPIC_ID}")
if [[ "$ensure_resp" != "200" && "$ensure_resp" != "409" ]]; then
  echo "[gcp-smoke] ERROR: ensure topic failed HTTP ${ensure_resp}" >&2
  exit 3
fi

echo "[gcp-smoke] Publishing test message"
pub_resp=$(curl -s -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
  -X POST "https://pubsub.googleapis.com/v1/projects/${PROJECT_ID}/topics/${PUBSUB_TOPIC_ID}:publish" \
  -d '{"messages":[{"data":"YXV0b2Fkcy1zbW9rZS10ZXN0"}]}' )
mid=$(echo "$pub_resp" | jq -r '.messageIds[0] // empty')
if [[ -z "$mid" ]]; then
  echo "[gcp-smoke] ERROR: publish failed: $pub_resp" >&2
  exit 4
fi
echo "[gcp-smoke] Pub/Sub publish OK: ${mid}"

echo "[gcp-smoke] Firestore list documents: blog_posts (db=${FIRESTORE_DATABASE_ID})"
fs_code=$(curl -s -o /tmp/fs.json -w "%{http_code}" -H "Authorization: Bearer ${token}" \
  "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/blog_posts?pageSize=1")
if [[ "$fs_code" != "200" ]]; then
  echo "[gcp-smoke] ERROR: Firestore list failed HTTP ${fs_code}" >&2
  cat /tmp/fs.json || true
  exit 5
fi
echo "[gcp-smoke] Firestore OK" && head -c 200 /tmp/fs.json || true
echo
echo "[gcp-smoke] Done"
