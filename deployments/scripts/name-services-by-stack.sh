#!/usr/bin/env bash
set -euo pipefail

# Render/rename Cloud Run services with {service}-{stack} naming and apply labels.
# Non-destructive by default: prints the target names and labels; when RUN=1, applies labels.
# Usage:
#   STACK=preview PROJECT_ID=${GCP_PROJECT_ID} REGION=asia-northeast1 \
#   ./deployments/scripts/name-services-by-stack.sh

STACK=${STACK:-dev}
PROJECT_ID=${PROJECT_ID:-${GCP_PROJECT_ID}}
REGION=${REGION:-asia-northeast1}
RUN=${RUN:-0}

SERVICES=(billing offer siterank batchopen adscenter notifications console frontend browser-exec)

echo "[plan] stack=$STACK project=$PROJECT_ID region=$REGION"
for s in "${SERVICES[@]}"; do
  name="${s}-${STACK}"
  echo "- service: ${s} => ${name} (label gm-stack=${STACK})"
  if [[ "$RUN" == "1" ]]; then
    if ! command -v gcloud >/dev/null 2>&1; then echo "gcloud not found" >&2; exit 127; fi
    gcloud --project "$PROJECT_ID" run services update "$s" \
      --region "$REGION" --update-labels "gm-stack=${STACK}" || true
  fi
done

echo "[note] renaming services should be done via deploy pipelines; this script only labels existing services."

