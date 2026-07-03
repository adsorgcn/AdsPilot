#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:?service name required}"
ENVIRONMENT="${2:-preview}"

PROJECT_ID="${PROJECT_ID:?PROJECT_ID env required}"
REGION="${REGION:-asia-northeast1}"

target_service="$SERVICE"
if [[ "$ENVIRONMENT" == "preview" ]]; then
  target_service="${SERVICE}-preview"
fi

# Special handling for browser-exec (worker is deployed separately; skip)
if [[ "$SERVICE" == "browser-exec" ]]; then
  if [[ "$ENVIRONMENT" == "preview" ]]; then
    target_service="browser-exec-preview"
  else
    target_service="browser-exec"
  fi
fi

echo "🔎 Smoke check for ${target_service} (env: ${ENVIRONMENT})"
service_url=$(gcloud run services describe "${target_service}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)' 2>/dev/null || true)

if [[ -z "${service_url}" ]]; then
  echo "❌ Unable to resolve Cloud Run URL for ${target_service}" >&2
  exit 1
fi

declare -a endpoints=("/healthz" "/readyz" "/health" "/")
success=false
for ep in "${endpoints[@]}"; do
  url="${service_url%/}${ep}"
  echo "  → probing ${url}"
  if curl -sSf "${url}" >/dev/null 2>&1; then
    echo "✅ ${target_service} responded on ${ep}"
    success=true
    break
  fi
done

if [[ "${success}" != "true" ]]; then
  echo "❌ ${target_service} is not responding to health endpoints" >&2
  exit 1
fi

echo "🎉 Smoke check passed for ${target_service}"
