#!/bin/bash

# Verify all services can build successfully
# This script tests local Go builds for all services

set -e

PROJECT_ROOT=$(pwd)
FAILED_SERVICES=()
SUCCESSFUL_SERVICES=()

echo "🔍 Verifying all services can build..."
echo ""

# List of Go services to build
GO_SERVICES=(
    "adscenter"
    "batchopen"
    "billing"
    "console"
    "notifications"
    "offer"
    "projector"
    "proxy-pool"
    "recommendations"
    "siterank"
)

# Node.js services (skip for now)
NODE_SERVICES=(
    "browser-exec"
)

echo "📦 Testing Go services build..."
echo ""

for service in "${GO_SERVICES[@]}"; do
    echo "Building $service..."
    
    if [ -d "services/$service" ]; then
        cd "services/$service"
        
        # Run go mod tidy
        if go mod tidy 2>&1; then
            # Try to build
            if go build -o "${service}-service" . 2>&1; then
                echo "✅ $service: Build successful"
                SUCCESSFUL_SERVICES+=("$service")
                # Clean up binary
                rm -f "${service}-service"
            else
                echo "❌ $service: Build failed"
                FAILED_SERVICES+=("$service")
            fi
        else
            echo "❌ $service: go mod tidy failed"
            FAILED_SERVICES+=("$service")
        fi
        
        cd "$PROJECT_ROOT"
        echo ""
    else
        echo "⚠️  $service: Directory not found"
        echo ""
    fi
done

echo "📊 Build Summary"
echo "================"
echo ""
echo "✅ Successful: ${#SUCCESSFUL_SERVICES[@]}/${#GO_SERVICES[@]}"
for service in "${SUCCESSFUL_SERVICES[@]}"; do
    echo "   - $service"
done
echo ""

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    echo "❌ Failed: ${#FAILED_SERVICES[@]}/${#GO_SERVICES[@]}"
    for service in "${FAILED_SERVICES[@]}"; do
        echo "   - $service"
    done
    echo ""
    echo "⚠️  Some services failed to build. Please check the errors above."
    exit 1
else
    echo "🎉 All services built successfully!"
    echo ""
    echo "📝 Node.js services (not tested):"
    for service in "${NODE_SERVICES[@]}"; do
        echo "   - $service"
    done
    echo ""
    echo "✨ Ready for deployment!"
fi
