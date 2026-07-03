#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED: 使用 Pub/Sub 分发器替代 HTTP+OIDC 调度。
# 推荐：`deployments/scripts/create-scheduler-pubsub-dispatch.sh` 并设置
#   URL="https://<recommend>/api/v1/recommend/internal/offline/brand-coverage-audit?days=30&shard=0&totalShards=1" HEADERS_JSON='{"X-Service-Token":"ENV","Accept":"application/json"}'
#
# Create/Update Cloud Scheduler job to trigger Recommendations offline brand audit periodically.
# Usage:
#   PROJECT_ID=... REGION=asia-northeast1 STACK=preview \
#   SEED_DOMAIN=example.com COUNTRY=US DAYS=30 SHARD=0 TOTAL_SHARDS=1 \
#   SCHEDULE="0 * * * *" ./deployments/scripts/create-brand-audit-scheduler.sh
#
# Env:
#   PROJECT_ID, REGION, STACK
#   SERVICE: recommendations (default)
#   SEED_DOMAIN, COUNTRY, DAYS, SHARD, TOTAL_SHARDS
#   OIDC_SERVICE_ACCOUNT: service account for OIDC token (default: service runtime SA)

PROJECT_ID=${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}
REGION=${REGION:-asia-northeast1}
STACK=${STACK:-preview}
SERVICE=${SERVICE:-recommendations}
SEED_DOMAIN=${SEED_DOMAIN:-}
COUNTRY=${COUNTRY:-}
DAYS=${DAYS:-30}
SHARD=${SHARD:-0}
TOTAL_SHARDS=${TOTAL_SHARDS:-1}
SCHEDULE=${SCHEDULE:-"0 * * * *"}
OIDC_SERVICE_ACCOUNT=${OIDC_SERVICE_ACCOUNT:-}

if [[ -z "$PROJECT_ID" || -z "$SEED_DOMAIN" ]]; then
  echo "PROJECT_ID and SEED_DOMAIN required" >&2
  exit 2
fi

NAME="${SERVICE}-${STACK}"
JOB_ID="${SERVICE}-${STACK}-brand-audit-${SEED_DOMAIN//./-}"

RUN_URL=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$RUN_URL" ]]; then
  RUN_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$RUN_URL" ]]; then echo "Cloud Run URL not found for ${NAME}/${SERVICE}" >&2; exit 3; fi

TARGET_URL="${RUN_URL}/api/v1/recommend/internal/offline/brand-audit"
BODY=$(jq -n --arg sd "$SEED_DOMAIN" --arg c "$COUNTRY" --argjson d "$DAYS" --argjson s "$SHARD" --argjson t "$TOTAL_SHARDS" \
  '{seedDomain:$sd} + (if $c != "" then {country:$c} else {} end) + {days:$d, shard:$s, totalShards:$t}')

OIDC_ARG=()
if [[ -n "$OIDC_SERVICE_ACCOUNT" ]]; then
  OIDC_ARG=("--oidc-service-account-email=$OIDC_SERVICE_ACCOUNT")
else
  SA=$(gcloud run services describe "$NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(template.spec.serviceAccountName)' 2>/dev/null || true)
  if [[ -n "$SA" ]]; then OIDC_ARG=("--oidc-service-account-email=$SA"); fi
fi

echo "[scheduler] upsert brand-audit job ${JOB_ID} -> ${TARGET_URL} seed=${SEED_DOMAIN}"
if gcloud scheduler jobs describe "$JOB_ID" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" --time-zone "UTC" \
    --http-method POST --uri "$TARGET_URL" \
    --headers "Content-Type=application/json" \
    --message-body "$BODY" \
    "${OIDC_ARG[@]}"
else
  gcloud scheduler jobs create http "$JOB_ID" \
    --location "$REGION" --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" --time-zone "UTC" \
    --http-method POST --uri "$TARGET_URL" \
    --headers "Content-Type=application/json" \
    --message-body "$BODY" \
    "${OIDC_ARG[@]}"
fi

echo "[DONE] Scheduler job ${JOB_ID} created/updated"
