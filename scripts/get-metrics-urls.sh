#!/bin/bash
# Get all Cloud Run service /metrics endpoint URLs for Grafana configuration

set -euo pipefail

# Configuration
PROJECT_ID="${GCP_PROJECT:-gm-439917}"
REGION="${GCP_REGION:-asia-northeast1}"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Google-Monetize Metrics URLs                 ║${NC}"
echo -e "${BLUE}║   For Grafana Cloud Configuration      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Services with business metrics
BUSINESS_SERVICES=("billing-preview" "offer-preview" "adscenter-preview")

# All services (for HTTP metrics)
ALL_SERVICES=(
  "billing-preview"
  "offer-preview"
  "adscenter-preview"
  "batchopen-preview"
  "siterank-preview"
  "recommendations-preview"
  "console-preview"
  "proxy-pool-preview"
  "notifications-preview"
)

echo -e "${GREEN}=== Core Services (Business Metrics) ===${NC}"
echo ""

for service in "${BUSINESS_SERVICES[@]}"; do
  URL=$(gcloud run services describe "$service" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format='value(status.url)' 2>/dev/null || echo "")

  if [ -n "$URL" ]; then
    echo -e "${GREEN}✓${NC} $service"
    echo "   Metrics URL: ${URL}/metrics"
    echo ""
  else
    echo -e "${YELLOW}⚠${NC} $service: NOT DEPLOYED"
    echo ""
  fi
done

echo ""
echo -e "${BLUE}=== All Services (HTTP Metrics) ===${NC}"
echo ""

for service in "${ALL_SERVICES[@]}"; do
  URL=$(gcloud run services describe "$service" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format='value(status.url)' 2>/dev/null || echo "")

  if [ -n "$URL" ]; then
    echo -e "${GREEN}✓${NC} $service: ${URL}/metrics"
  else
    echo -e "${YELLOW}⚠${NC} $service: NOT DEPLOYED"
  fi
done

echo ""
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Grafana Cloud Configuration Steps                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "1. Sign up for Grafana Cloud (free tier):"
echo "   https://grafana.com/auth/sign-up/create-user"
echo ""
echo "2. Add Prometheus Data Sources:"
echo ""
echo "   For each service above, create a data source with:"
echo "   - Name: Google-Monetize <service-name>"
echo "   - URL: <Metrics URL from above>"
echo "   - HTTP Method: GET"
echo "   - Access: Server (default)"
echo ""
echo "3. Import Dashboards:"
echo "   - monitoring/prometheus/dashboards/billing-overview.json"
echo "   - monitoring/prometheus/dashboards/ad-performance.json"
echo ""
echo "4. Test metrics with Explore:"
echo "   - Query: gm_billing_tokens_consumed_total"
echo "   - Query: gm_offer_offers_created_total"
echo ""
echo -e "${GREEN}Full guide: monitoring/grafana-cloud-setup.md${NC}"
echo ""

# Output JSON for programmatic use
echo ""
echo -e "${BLUE}=== JSON Output (for automation) ===${NC}"
echo ""

echo "{"
echo "  \"project\": \"$PROJECT_ID\","
echo "  \"region\": \"$REGION\","
echo "  \"services\": ["

FIRST=true
for service in "${BUSINESS_SERVICES[@]}"; do
  URL=$(gcloud run services describe "$service" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format='value(status.url)' 2>/dev/null || echo "")

  if [ -n "$URL" ]; then
    if [ "$FIRST" = false ]; then
      echo ","
    fi
    FIRST=false
    echo -n "    {"
    echo -n "\"name\": \"$service\", "
    echo -n "\"url\": \"$URL\", "
    echo -n "\"metrics_url\": \"${URL}/metrics\""
    echo -n "}"
  fi
done

echo ""
echo "  ]"
echo "}"
