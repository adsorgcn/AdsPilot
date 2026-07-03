#!/bin/bash
# Enable OpenTelemetry distributed tracing for all Go services
# Usage: ./scripts/enable-distributed-tracing.sh [preview|production]

set -euo pipefail

ENVIRONMENT=${1:-preview}
REGION="asia-northeast1"

# Default tracing configuration
TRACES_ENABLED="1"
OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector:4318"  # Replace with actual endpoint
TRACES_SAMPLER_RATIO="0.01"  # 1% sampling rate

if [ "$ENVIRONMENT" == "production" ]; then
  echo "⚠️  Configuring tracing for PRODUCTION environment..."
  SERVICES=(
    "offer"
    "billing"
    "adscenter"
    "siterank"
    "console"
  )
  TRACES_SAMPLER_RATIO="0.001"  # 0.1% sampling for production
else
  echo "✅ Configuring tracing for PREVIEW environment..."
  SERVICES=(
    "offer-preview"
    "billing-preview"
    "adscenter-preview"
    "siterank-preview"
    "console-preview"
  )
  TRACES_SAMPLER_RATIO="0.1"  # 10% sampling for preview
fi

echo ""
echo "Configuration:"
echo "  TRACES_ENABLED=${TRACES_ENABLED}"
echo "  OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT}"
echo "  TRACES_SAMPLER_RATIO=${TRACES_SAMPLER_RATIO}"
echo ""

for SERVICE in "${SERVICES[@]}"; do
  echo "Updating ${SERVICE}..."

  # Use --update-env-vars instead of --set-env-vars to preserve existing variables
  gcloud run services update "${SERVICE}" \
    --region="${REGION}" \
    --update-env-vars="TRACES_ENABLED=${TRACES_ENABLED},OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT},TRACES_SAMPLER_RATIO=${TRACES_SAMPLER_RATIO}" \
    --quiet || echo "⚠️  Failed to update ${SERVICE}"

  echo "✅ ${SERVICE} updated"
  echo ""
done

echo "🎉 Distributed tracing configuration completed!"
echo ""
echo "To verify, check service logs for:"
echo "  - OpenTelemetry initialization messages"
echo "  - Trace exports to ${OTEL_EXPORTER_OTLP_ENDPOINT}"
echo ""
echo "⚠️  Note: You need to deploy an OpenTelemetry Collector to ${OTEL_EXPORTER_OTLP_ENDPOINT}"
echo "   Or configure a different endpoint (e.g., Cloud Trace, Jaeger, etc.)"
