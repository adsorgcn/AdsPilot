#!/bin/bash

# Subscription API Test Script
# Tests the new subscription configuration endpoints

set -e

GATEWAY_URL="https://gm-gw-preview-885pd7lz.an.gateway.dev"
BILLING_URL="https://billing-preview-yt54xvsg5q-an.a.run.app"

echo "🧪 Testing Subscription Configuration API Endpoints"
echo "=================================================="

echo ""
echo "1. Testing Billing Service Health Check..."
curl -s "${BILLING_URL}/health" | head -200

echo ""
echo "2. Testing Direct Service Endpoint (should return auth error)..."
echo "   GET ${BILLING_URL}/api/v1/billing/config/all"
RESPONSE=$(curl -s "${BILLING_URL}/api/v1/billing/config/all")
echo "$RESPONSE" | head -200

echo ""
echo "3. Testing API Gateway Endpoint (should return 404 until gateway is updated)..."
echo "   GET ${GATEWAY_URL}/api/v1/billing/config/all"
RESPONSE=$(curl -s "${GATEWAY_URL}/api/v1/billing/config/all")
echo "$RESPONSE" | head -200

echo ""
echo "4. Testing Individual Endpoints..."
ENDPOINTS=(
    "/api/v1/billing/config/pricing"
    "/api/v1/billing/config/history"
    "/api/v1/billing/trial/status"
    "/api/v1/billing/admin/permissions"
    "/api/v1/billing/admin/token-costs"
)

for endpoint in "${ENDPOINTS[@]}"; do
    echo ""
    echo "   GET ${GATEWAY_URL}${endpoint}"
    RESPONSE=$(curl -s "${GATEWAY_URL}${endpoint}")
    echo "$RESPONSE" | head -200
done

echo ""
echo "=================================================="
echo "✅ API Endpoint Testing Complete"
echo ""
echo "Expected Results:"
echo "- Billing service health: OK"
echo "- Direct service calls: Unauthorized (expected)"
echo "- Gateway calls: 404 Not Found (expected until gateway is updated)"
echo ""
echo "Next Steps:"
echo "1. Update API Gateway configuration to include new endpoints"
echo "2. Test with proper JWT authentication"
echo "3. Verify database connectivity and data returns"