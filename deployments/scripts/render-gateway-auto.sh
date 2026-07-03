#!/usr/bin/env bash
set -euo pipefail

# Auto-render gateway v2 by discovering Cloud Run service URLs via gcloud.
# Outputs deployments/gateway/gateway.v2.rendered.yaml

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
REGION="${REGION:-asia-northeast1}"
STACK="${STACK:-}"
SRC="deployments/gateway/gateway.v2.yaml"
OUT="deployments/gateway/gateway.v2.rendered.yaml"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: PROJECT_ID or GOOGLE_CLOUD_PROJECT required" >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null

cp "$SRC" "$OUT"

# Replace project id
sed -i '' -e "s#<PROJECT_ID>#$PROJECT_ID#g" "$OUT"

discover_and_replace() {
  local base="$1"           # logical service name, e.g., siterank
  local placeholder="$2"     # placeholder token in gateway spec
  local svc="$base"
  local url host
  # Prefer stack-suffixed service name when STACK provided
  if [[ -n "$STACK" ]]; then
    svc="${base}-${STACK}"
  fi
  url=$(gcloud run services describe "$svc" --region "$REGION" --format 'value(status.url)' 2>/dev/null || true)
  # Fallback to base name when suffixed service not found
  if [[ -z "$url" && -n "$STACK" ]]; then
    echo "[render] WARN: $svc not found, try base name $base"
    url=$(gcloud run services describe "$base" --region "$REGION" --format 'value(status.url)' 2>/dev/null || true)
    svc="$base"
  fi
  if [[ -z "$url" ]]; then
    echo "[render] WARN: service $svc not found; keep placeholder $placeholder"
    return
  fi
  host=${url#https://}
  # Prefer stable domain form <service>-<projectNumber>.<region>.run.app when possible
  if [[ -n "$PROJECT_ID" ]]; then
    PN=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
    if [[ -n "$PN" ]]; then
      host="${svc}-${PN}.${REGION}.run.app"
    fi
  fi
  echo "[render] $svc -> $url"
  sed -i '' -e "s#$placeholder#$host#g" "$OUT"
}

discover_and_replace offer offer-REPLACE_WITH_RUN_URL
discover_and_replace siterank siterank-REPLACE_WITH_RUN_URL
discover_and_replace batchopen batchopen-REPLACE_WITH_RUN_URL
discover_and_replace billing billing-REPLACE_WITH_RUN_URL
discover_and_replace adscenter adscenter-REPLACE_WITH_RUN_URL
discover_and_replace notifications notifications-REPLACE_WITH_RUN_URL
discover_and_replace recommendations recommendations-REPLACE_WITH_RUN_URL
discover_and_replace console console-REPLACE_WITH_RUN_URL

echo "[render] Rendered -> $OUT"
