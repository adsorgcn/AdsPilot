#!/usr/bin/env bash
set -euo pipefail

# Deploy browser-exec service to Cloud Run with special configuration
# Usage: bash deployments/scripts/deploy-browser-exec.sh <environment> <image>
# Example: bash deployments/scripts/deploy-browser-exec.sh preview asia-northeast1-docker.pkg.dev/PROJECT/REPO/browser-exec:preview-abc123

ENVIRONMENT="${1:-preview}"
IMAGE="${2:-}"
PROJECT_ID="${PROJECT_ID:-${GCP_PROJECT_ID}}"
REGION="${REGION:-asia-northeast1}"

if [[ -z "$IMAGE" ]]; then
  echo "ERROR: IMAGE argument required" >&2
  echo "Usage: $0 <environment> <image>" >&2
  exit 1
fi

# Determine service name based on environment
if [[ "$ENVIRONMENT" == "prod" ]]; then
  SERVICE_NAME="browser-exec"
else
  SERVICE_NAME="browser-exec-preview"
fi

echo "Deploying browser-exec to Cloud Run"
echo "  Environment: ${ENVIRONMENT}"
echo "  Service: ${SERVICE_NAME}"
echo "  Image: ${IMAGE}"
echo "  Region: ${REGION}"
echo ""

# Deploy with special configuration for Playwright
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 80 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300s \
  --set-env-vars "PLAYWRIGHT=1,BROWSER_MAX_CONCURRENCY=4,BROWSER_MAX_CONTEXTS=12,BROWSER_MAX_MEMORY_MB=1536,NODE_ENV=production" \
  --execution-environment gen2

echo ""
echo "✅ browser-exec deployed successfully!"
echo "Service URL: https://${SERVICE_NAME}-644672509127.${REGION}.run.app"
