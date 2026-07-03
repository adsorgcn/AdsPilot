#!/bin/bash

echo "🧪 Testing Adscenter API..."

ADSCENTER_URL="https://adscenter-preview-yt54xvsg5q-an.a.run.app"

# Test health endpoint
echo "1. Testing /health endpoint..."
curl -s "$ADSCENTER_URL/health" && echo " ✅"

# Test diagnose endpoint (should require auth)
echo ""
echo "2. Testing /api/v1/diagnose endpoint (without auth)..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$ADSCENTER_URL/api/v1/diagnose")
echo "$RESPONSE"

# Test with invalid token
echo ""
echo "3. Testing /api/v1/diagnose endpoint (with invalid token)..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "Authorization: Bearer invalid-token" "$ADSCENTER_URL/api/v1/diagnose")
echo "$RESPONSE"

echo ""
echo "✅ Adscenter API testing complete!"
