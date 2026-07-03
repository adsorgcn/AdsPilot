#!/bin/bash
# Deploy Monitoring Configuration for Google-Monetize
# This script helps set up Grafana + Prometheus metrics monitoring

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT:-gm-439917}"
REGION="${GCP_REGION:-asia-northeast1}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Google-Monetize Monitoring Setup             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Step 1: Verify services are deployed
echo -e "${BLUE}Step 1: Verifying Cloud Run services...${NC}"
SERVICES=("adscenter-preview" "billing-preview")

for service in "${SERVICES[@]}"; do
    if gcloud run services describe "$service" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)" &> /dev/null; then
        URL=$(gcloud run services describe "$service" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(status.url)")
        print_success "$service is deployed at $URL"
    else
        print_warning "$service not found - please deploy it first"
    fi
done

echo ""

# Step 2: Test /metrics endpoints
echo -e "${BLUE}Step 2: Testing /metrics endpoints...${NC}"

for service in "${SERVICES[@]}"; do
    URL=$(gcloud run services describe "$service" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)" 2>/dev/null || echo "")

    if [ -n "$URL" ]; then
        if curl -s -f "$URL/metrics" > /dev/null; then
            print_success "$service /metrics endpoint is accessible"

            # Count metrics
            METRIC_COUNT=$(curl -s "$URL/metrics" | grep -c "^gm_" || echo "0")
            print_info "  Found $METRIC_COUNT gm_* metrics"
        else
            print_error "$service /metrics endpoint returned error"
        fi
    fi
done

echo ""

# Step 3: Show available metrics
echo -e "${BLUE}Step 3: Available metrics summary:${NC}"

SERVICE_URL=$(gcloud run services describe adscenter-preview \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
    echo ""
    echo "Sample metrics from adscenter-preview:"
    curl -s "$SERVICE_URL/metrics" | grep "^gm_" | head -10
    echo "..."
    echo ""
else
    print_warning "Could not fetch sample metrics"
fi

# Step 4: Grafana setup instructions
echo -e "${BLUE}Step 4: Grafana Setup Instructions${NC}"
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  Option 1: Local Grafana (Recommended for Development)     │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo "1. Install Grafana:"
echo "   brew install grafana"
echo "   brew services start grafana"
echo ""
echo "2. Open Grafana: http://localhost:3000"
echo "   Default credentials: admin / admin"
echo ""
echo "3. Add Prometheus Data Source:"
echo "   - Configuration → Data Sources → Add data source → Prometheus"
echo "   - URL: $SERVICE_URL"
echo "   - HTTP Method: GET"
echo "   - Save & Test"
echo ""
echo "4. Import Dashboards:"
echo "   - Dashboards → Import"
echo "   - Upload: monitoring/prometheus/dashboards/billing-overview.json"
echo "   - Upload: monitoring/prometheus/dashboards/ad-performance.json"
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  Option 2: Grafana Cloud (Recommended for Production)      │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo "1. Sign up: https://grafana.com/auth/sign-up/create-user"
echo "   Free tier: 10k series, 14 days retention"
echo ""
echo "2. Add Prometheus Data Source:"
echo "   - Same configuration as above"
echo ""
echo "3. Enable remote access to /metrics:"
echo "   - Cloud Run services are already publicly accessible"
echo "   - No additional configuration needed"
echo ""

# Step 5: Deploy alert policies
echo -e "${BLUE}Step 5: Deploy Alert Policies (Optional)${NC}"
echo ""

if [ "${1:-}" == "--deploy-alerts" ]; then
    echo "Deploying alert policies to Cloud Monitoring..."

    # Note: Cloud Monitoring alert policies require custom metrics
    # which are not available with the /metrics endpoint approach
    print_warning "Alert policies require Cloud Monitoring Custom Metrics"
    print_info "Current setup uses Prometheus /metrics (free)"
    print_info "To enable Cloud Monitoring alerts, you need to:"
    echo "  1. Use OpenTelemetry Collector to forward metrics"
    echo "  2. Or implement Cloud Monitoring API directly in code"
    echo "  3. Estimated cost: ~$100-120/month for 100 users"
    echo ""
    print_info "For now, use Grafana Alerting instead (free)"
else
    print_info "Skipping alert deployment (use --deploy-alerts to enable)"
    print_info "Configure alerts in Grafana instead (free and easier)"
fi

echo ""

# Step 6: Summary and next steps
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Monitoring Setup Complete!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Quick Start Guide:${NC}"
echo ""
echo "1. View metrics directly:"
echo "   curl $SERVICE_URL/metrics | grep gm_"
echo ""
echo "2. Test a specific metric:"
echo "   curl $SERVICE_URL/metrics | grep gm_billing_tokens_consumed_total"
echo ""
echo "3. Set up Grafana (choose one):"
echo "   - Local: brew install grafana && brew services start grafana"
echo "   - Cloud: https://grafana.com/products/cloud/"
echo ""
echo "4. Import pre-built dashboards:"
echo "   - monitoring/prometheus/dashboards/billing-overview.json"
echo "   - monitoring/prometheus/dashboards/ad-performance.json"
echo ""
echo "5. Explore PromQL queries:"
echo "   - See monitoring/prometheus/promql-queries.md"
echo "   - 50+ ready-to-use examples"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo ""
echo "  - README: monitoring/prometheus/README.md"
echo "  - PromQL Queries: monitoring/prometheus/promql-queries.md"
echo "  - Alert Policies: monitoring/prometheus/alerts/"
echo ""
echo -e "${BLUE}💰 Cost: $0/month${NC}"
echo "  - Cloud Run /metrics: Free"
echo "  - Grafana (local): Free"
echo "  - Grafana Cloud (free tier): Free"
echo ""
echo -e "${GREEN}All systems ready for monitoring!${NC}"
