#!/usr/bin/env bash
set -euo pipefail

# Render deployments/gateway/gateway.v2.yaml to deployments/gateway/gateway.v2.rendered.yaml
# Replace <PROJECT_ID> and *-REPLACE_WITH_RUN_URL placeholders from env vars.
#
# Required env:
#   PROJECT_ID (or GOOGLE_CLOUD_PROJECT)
# Optional env (full https URLs expected, e.g., https://siterank-xxxxx-ane1.run.app):
#   SITERANK_URL ADSCENTER_URL BATCHOPEN_URL BILLING_URL OFFER_URL NOTIFICATIONS_URL RECOMMENDATIONS_URL CONSOLE_URL

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SRC="$ROOT_DIR/deployments/gateway/gateway.v2.yaml"
OUT="$ROOT_DIR/deployments/gateway/gateway.v2.rendered.yaml"

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set" >&2
  exit 1
fi

cp "$SRC" "$OUT"

# Project substitutions
sed -i '' -e "s#<PROJECT_ID>#$PROJECT_ID#g" "$OUT"

# Backend URLs
declare -A MAP=(
  ["siterank-REPLACE_WITH_RUN_URL"]="${SITERANK_URL:-}"
  ["adscenter-REPLACE_WITH_RUN_URL"]="${ADSCENTER_URL:-}"
  ["batchopen-REPLACE_WITH_RUN_URL"]="${BATCHOPEN_URL:-}"
  ["billing-REPLACE_WITH_RUN_URL"]="${BILLING_URL:-}"
  ["offer-REPLACE_WITH_RUN_URL"]="${OFFER_URL:-}"
  ["notifications-REPLACE_WITH_RUN_URL"]="${NOTIFICATIONS_URL:-}"
  ["recommendations-REPLACE_WITH_RUN_URL"]="${RECOMMENDATIONS_URL:-}"
  ["console-REPLACE_WITH_RUN_URL"]="${CONSOLE_URL:-}"
)

for key in "${!MAP[@]}"; do
  val="${MAP[$key]}"
  if [[ -n "$val" ]]; then
    # Escape slashes and special sed chars
    esc=$(printf '%s\n' "$val" | sed -e 's/[\/&]/\\&/g')
    sed -i '' -e "s#$key#$esc#g" "$OUT"
  fi
done

echo "Rendered: $OUT"

