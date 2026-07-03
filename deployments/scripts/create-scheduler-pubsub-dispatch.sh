#!/usr/bin/env bash
set -euo pipefail

# Create/update a Cloud Scheduler job to publish an HTTP dispatch payload to Pub/Sub.
# Payload: { url, method, headers, body, timeoutMs }
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 TOPIC=jobs-dispatcher \
#   SCHEDULE="*/5 * * * *" URL=https://service.run.app/api/... METHOD=POST \
#   ./deployments/scripts/create-scheduler-pubsub-dispatch.sh

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
TOPIC=${TOPIC:-jobs-dispatcher}
SCHEDULE=${SCHEDULE:-"*/5 * * * *"}
URL=${URL:-}
METHOD=${METHOD:-POST}
TIMEOUT_MS=${TIMEOUT_MS:-5000}
HEADERS_JSON=${HEADERS_JSON:-'{"X-Service-Token":"ENV"}'}
BODY_JSON=${BODY_JSON:-'{}'}
JOB_ID=${JOB_ID:-dispatcher-$(date +%s)}

if [[ -z "$PROJECT_ID" || -z "$URL" ]]; then echo "PROJECT_ID and URL required" >&2; exit 2; fi

payload=$(jq -c -n --arg url "$URL" --arg method "$METHOD" --argjson headers "$HEADERS_JSON" --argjson body "$BODY_JSON" --argjson t "$TIMEOUT_MS" '{url:$url, method:$method, headers:$headers, body:$body, timeoutMs: ($t|tonumber)}')

gcloud pubsub topics describe "$TOPIC" >/dev/null 2>&1 || gcloud pubsub topics create "$TOPIC"

if gcloud scheduler jobs describe "$JOB_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update pubsub "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" --topic "$TOPIC" \
    --message-body "$payload" --time-zone "UTC"
else
  gcloud scheduler jobs create pubsub "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" --topic "$TOPIC" \
    --message-body "$payload" --time-zone "UTC"
fi

echo "[DONE] Scheduler pubsub job $JOB_ID -> $TOPIC with payload $payload"

