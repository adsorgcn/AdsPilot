#!/bin/bash

echo "🧪 Testing Preview Environment Services..."
echo ""

# Get actual service URLs
ADSCENTER_URL=$(gcloud run services describe adscenter-preview --region=asia-northeast1 --project=${GCP_PROJECT_ID} --format="value(status.url)" 2>/dev/null)
BROWSER_EXEC_URL=$(gcloud run services describe browser-exec-preview --region=asia-northeast1 --project=${GCP_PROJECT_ID} --format="value(status.url)" 2>/dev/null)
SITERANK_URL=$(gcloud run services describe siterank-preview --region=asia-northeast1 --project=${GCP_PROJECT_ID} --format="value(status.url)" 2>/dev/null)

echo "📍 Service URLs:"
echo "  Adscenter: $ADSCENTER_URL"
echo "  Browser-Exec: $BROWSER_EXEC_URL"
echo "  Siterank: $SITERANK_URL"
echo ""

echo "🔍 Testing Health Endpoints..."

# Test Adscenter
if [ -n "$ADSCENTER_URL" ]; then
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$ADSCENTER_URL/health")
    if [ "$STATUS" = "200" ]; then
        echo "✅ Adscenter: OK ($STATUS)"
    else
        echo "❌ Adscenter: FAILED ($STATUS)"
    fi
fi

# Test Browser-Exec
if [ -n "$BROWSER_EXEC_URL" ]; then
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BROWSER_EXEC_URL/health")
    if [ "$STATUS" = "200" ]; then
        echo "✅ Browser-Exec: OK ($STATUS)"
    else
        echo "❌ Browser-Exec: FAILED ($STATUS)"
    fi
fi

# Test Siterank
if [ -n "$SITERANK_URL" ]; then
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$SITERANK_URL/health")
    if [ "$STATUS" = "200" ]; then
        echo "✅ Siterank: OK ($STATUS)"
    else
        echo "❌ Siterank: FAILED ($STATUS)"
    fi
fi

echo ""
echo "✅ Preview environment service testing complete!"
