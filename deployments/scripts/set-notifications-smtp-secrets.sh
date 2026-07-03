#!/usr/bin/env bash
set -euo pipefail

# Configure SMTP_* secrets for notifications service and roll update
# Usage:
#   PROJECT_ID=<id> REGION=asia-northeast1 SERVICE=notifications \
#   SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USERNAME=user SMTP_PASSWORD=pass SMTP_FROM=noreply@example.com \
#   ./deployments/scripts/set-notifications-smtp-secrets.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:-asia-northeast1}
SERVICE=${SERVICE:-notifications}

SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-}
SMTP_USERNAME=${SMTP_USERNAME:-}
SMTP_PASSWORD=${SMTP_PASSWORD:-}
SMTP_FROM=${SMTP_FROM:-}

if [[ -z "$SMTP_HOST" || -z "$SMTP_PORT" || -z "$SMTP_USERNAME" || -z "$SMTP_PASSWORD" || -z "$SMTP_FROM" ]]; then
  echo "All SMTP_* variables are required" >&2
  exit 2
fi

create_or_update_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID" >/dev/null
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --project "$PROJECT_ID" >/dev/null
  fi
}

for kv in SMTP_HOST:$SMTP_HOST SMTP_PORT:$SMTP_PORT SMTP_USERNAME:$SMTP_USERNAME SMTP_PASSWORD:$SMTP_PASSWORD SMTP_FROM:$SMTP_FROM; do
  name="${kv%%:*}"; val="${kv#*:}"
  echo "[secret] ensuring $name"
  create_or_update_secret "$name" "$val"
done

echo "[deploy] updating $SERVICE with secret-typed SMTP_* envs"
gcloud run services update "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" \
  --set-secrets SMTP_HOST=SMTP_HOST:latest,SMTP_PORT=SMTP_PORT:latest,SMTP_USERNAME=SMTP_USERNAME:latest,SMTP_PASSWORD=SMTP_PASSWORD:latest,SMTP_FROM=SMTP_FROM:latest \
  --quiet

echo "Done."

