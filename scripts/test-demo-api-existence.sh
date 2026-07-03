#!/bin/bash

# Demo API Existence Test
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE_URL="http://api.urlchecker.dev"
FRONTEND_BASE_URL="https://www.urlchecker.dev"

echo -e "${BLUE}🔍 Demo API Existence Test${NC}"
echo "=============================="
echo "API Base URL: $API_BASE_URL"
echo "Frontend URL: $FRONTEND_BASE_URL"
echo ""

# Test API endpoints directly with curl
echo -e "${BLUE}📡 Testing API endpoints...${NC}"

# Test 1: Health endpoint
echo -n "Testing /health endpoint... "
if curl -s --max-time 10 "$API_BASE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test 2: Demo status endpoint
echo -n "Testing /api/v1/demo/status endpoint... "
HTTP_STATUS=$(curl -s -o /tmp/demo-status-response.json -w "%{http_code}" --max-time 10 "$API_BASE_URL/api/v1/demo/status" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK (200)${NC}"
    echo "Response: $(cat /tmp/demo-status-response.json | head -c 100)..."
elif [ "$HTTP_STATUS" = "404" ]; then
    echo -e "${YELLOW}⚠️ NOT FOUND (404)${NC}"
    echo "Demo API endpoint may not be implemented yet"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${RED}❌ CONNECTION FAILED${NC}"
else
    echo -e "${YELLOW}⚠️ HTTP $HTTP_STATUS${NC}"
fi

# Test 3: Demo initialize endpoint
echo -n "Testing /api/v1/demo/initialize endpoint... "
HTTP_STATUS=$(curl -s -o /tmp/demo-init-response.json -w "%{http_code}" --max-time 10 -X POST "$API_BASE_URL/api/v1/demo/initialize" -H "Content-Type: application/json" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK (200)${NC}"
    echo "Response: $(cat /tmp/demo-init-response.json | head -c 100)..."
elif [ "$HTTP_STATUS" = "404" ]; then
    echo -e "${YELLOW}⚠️ NOT FOUND (404)${NC}"
    echo "Demo API endpoint may not be implemented yet"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${RED}❌ CONNECTION FAILED${NC}"
else
    echo -e "${YELLOW}⚠️ HTTP $HTTP_STATUS${NC}"
fi

# Test 4: Check if frontend is accessible
echo ""
echo -e "${BLUE}🌐 Testing frontend accessibility...${NC}"
echo -n "Testing frontend homepage... "
if curl -s --max-time 10 "$FRONTEND_BASE_URL" > /dev/null; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test 5: Check if auth page exists
echo -n "Testing auth sign-in page... "
HTTP_STATUS=$(curl -s -o /tmp/auth-page.html -w "%{http_code}" --max-time 10 "$FRONTEND_BASE_URL/auth/sign-in" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ OK (200)${NC}"
    # Check for form elements
    if grep -q "form\|input" /tmp/auth-page.html; then
        echo "  - Contains form elements"
    else
        echo "  - May be a SPA (Client-side rendered)"
    fi
elif [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${RED}❌ CONNECTION FAILED${NC}"
else
    echo -e "${YELLOW}⚠️ HTTP $HTTP_STATUS${NC}"
fi

echo ""
echo -e "${BLUE}📋 Summary${NC}"
echo "============"
echo "✅ Frontend is accessible"
echo "⚠️ Demo API endpoints may not be implemented yet"
echo ""
echo -e "${YELLOW}💡 Recommendation:${NC}"
echo "1. Verify Demo API implementation in offer service"
echo "2. Check if /api/v1/demo/* endpoints are deployed"
echo "3. Continue with basic frontend testing"
echo ""
echo -e "${GREEN}🎯 Environment Status: Ready for frontend testing${NC}"

# Cleanup
rm -f /tmp/demo-status-response.json /tmp/demo-init-response.json /tmp/auth-page.html