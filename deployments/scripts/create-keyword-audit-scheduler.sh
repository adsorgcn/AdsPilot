#!/usr/bin/env bash
set -euo pipefail

# Create/update a Cloud Scheduler job to trigger keyword audit (offline).
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 STACK=preview USERS="uid1,uid2" \
#   ./deployments/scripts/create-keyword-audit-scheduler.sh

PROJECT_ID=${PROJECT_ID:?}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
USERS=${USERS:-}

SERVICE="recommendations${STACK:+-${STACK}}"
RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then echo "[error] Cloud Run URL not found for $SERVICE" >&2; exit 1; fi

JOB_ID="keyword-audit-${STACK}"
TARGET_URL="${RUN_URL}/api/v1/recommend/internal/offline/keyword-audit"
SA=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(template.spec.serviceAccountName)' 2>/dev/null || true)
OIDC="projects/${PROJECT_ID}/serviceAccounts/${SA}"

DATA="{}"
if [[ -n "$USERS" ]]; then DATA="{\"users\":\"$USERS\"}"; fi

if gcloud scheduler jobs describe "$JOB_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "[scheduler] Updating $JOB_ID -> $TARGET_URL"
  gcloud scheduler jobs update http "$JOB_ID" \
    --location "$REGION" \
    --project "$PROJECT_ID" \
    --schedule "0 3 * * *" \
    --uri "$TARGET_URL" \
    --http-method POST \
    --oidc-service-account-email "$OIDC" \
    --headers "Content-Type=application/json" \
    --message-body "$DATA" >/dev/null
else
  echo "[scheduler] Creating $JOB_ID -> $TARGET_URL"
  gcloud scheduler jobs create http "$JOB_ID" \
    --location "$REGION" \
    --project "$PROJECT_ID" \
    --schedule "0 3 * * *" \
    --uri "$TARGET_URL" \
    --http-method POST \
    --oidc-service-account-email "$OIDC" \
    --headers "Content-Type=application/json" \
    --message-body "$DATA" >/dev/null
fi
echo "[done] Scheduler $JOB_ID configured."

