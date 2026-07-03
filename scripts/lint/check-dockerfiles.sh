#!/usr/bin/env bash
# Dockerfile Lint Script for Monorepo
#
# Purpose: Ensure all Go service Dockerfiles follow best practices
# Usage: ./scripts/lint/check-dockerfiles.sh
#
# Checks:
#   1. Go version matches go.work requirement (1.25+)
#   2. ENV GOWORK=off is set
#   3. Multi-stage build pattern
#   4. Optimization flags (-trimpath, -ldflags)
#   5. Minimal base image (distroless or alpine)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "🔍 Checking Dockerfile consistency across services..."
echo ""

# Get Go version requirement from go.work
GO_WORK_VERSION=$(grep -E '^go [0-9.]+' go.work | awk '{print $2}')
echo "📋 go.work requires Go: ${GO_WORK_VERSION}"
echo ""

# Find all Go services (exclude browser-exec)
GO_SERVICES=$(find services -maxdepth 1 -type d -name '*' ! -name 'browser-exec' ! -name 'services' | xargs -I{} basename {})

for service in $GO_SERVICES; do
    DOCKERFILE="services/${service}/Dockerfile"

    if [[ ! -f "$DOCKERFILE" ]]; then
        echo "⚠️  ${YELLOW}SKIP${NC}: ${service} - No Dockerfile found"
        continue
    fi

    echo "Checking: ${service}"

    # Check 1: Go version
    GO_VERSION=$(grep -E '^FROM golang:' "$DOCKERFILE" | head -1 | sed -E 's/.*golang:([0-9.]+).*/\1/')
    if [[ -z "$GO_VERSION" ]]; then
        echo "  ❌ ${RED}ERROR${NC}: No golang base image found"
        ((ERRORS++))
    elif [[ ! "$GO_VERSION" =~ ^1\.25 ]]; then
        echo "  ❌ ${RED}ERROR${NC}: Go version ${GO_VERSION} does not match go.work requirement (${GO_WORK_VERSION})"
        ((ERRORS++))
    else
        echo "  ✅ Go version: ${GO_VERSION}"
    fi

    # Check 2: GOWORK=off
    if grep -q "ENV GOWORK=off" "$DOCKERFILE"; then
        echo "  ✅ GOWORK=off is set"
    else
        echo "  ❌ ${RED}ERROR${NC}: Missing 'ENV GOWORK=off' - required to avoid module errors"
        ((ERRORS++))
    fi

    # Check 3: Multi-stage build
    STAGE_COUNT=$(grep -c "^FROM " "$DOCKERFILE" || true)
    if [[ $STAGE_COUNT -ge 2 ]]; then
        echo "  ✅ Multi-stage build (${STAGE_COUNT} stages)"
    else
        echo "  ⚠️  ${YELLOW}WARNING${NC}: Single-stage build detected (size optimization opportunity)"
        ((WARNINGS++))
    fi

    # Check 4: Build optimization flags
    if grep -q "\-trimpath" "$DOCKERFILE"; then
        echo "  ✅ -trimpath flag found"
    else
        echo "  ⚠️  ${YELLOW}WARNING${NC}: Missing '-trimpath' flag (recommended for smaller binaries)"
        ((WARNINGS++))
    fi

    if grep -q '\-ldflags.*-s -w' "$DOCKERFILE"; then
        echo "  ✅ -ldflags=\"-s -w\" found"
    else
        echo "  ⚠️  ${YELLOW}WARNING${NC}: Missing '-ldflags=\"-s -w\"' (recommended for smaller binaries)"
        ((WARNINGS++))
    fi

    # Check 5: Runtime image
    RUNTIME_IMAGE=$(grep "^FROM " "$DOCKERFILE" | tail -1 | awk '{print $2}')
    if [[ "$RUNTIME_IMAGE" == *"distroless"* ]]; then
        echo "  ✅ Runtime image: ${RUNTIME_IMAGE} (distroless - excellent)"
    elif [[ "$RUNTIME_IMAGE" == "alpine:latest" ]]; then
        echo "  ✅ Runtime image: ${RUNTIME_IMAGE} (alpine - good)"
    elif [[ "$RUNTIME_IMAGE" == *"golang"* ]]; then
        echo "  ❌ ${RED}ERROR${NC}: Runtime image is golang (bloated, should use distroless/alpine)"
        ((ERRORS++))
    else
        echo "  ⚠️  ${YELLOW}WARNING${NC}: Runtime image: ${RUNTIME_IMAGE} (consider distroless)"
        ((WARNINGS++))
    fi

    # Check 6: COPY pattern
    if grep -q "COPY go.work" "$DOCKERFILE"; then
        echo "  ✅ Copies go.work (monorepo-aware)"
    else
        echo "  ⚠️  ${YELLOW}WARNING${NC}: Doesn't copy go.work (may cause issues)"
        ((WARNINGS++))
    fi

    if grep -q "COPY pkg" "$DOCKERFILE"; then
        echo "  ✅ Copies pkg directory (shared packages)"
    else
        echo "  ⚠️  ${YELLOW}WARNING${NC}: Doesn't copy pkg directory (may miss shared dependencies)"
        ((WARNINGS++))
    fi

    echo ""
done

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "  Total services checked: $(echo "$GO_SERVICES" | wc -w | tr -d ' ')"
echo "  Errors: ${ERRORS}"
echo "  Warnings: ${WARNINGS}"
echo ""

if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
    echo "  ${GREEN}✅ All Dockerfiles are compliant!${NC}"
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    echo "  ${YELLOW}⚠️  No errors, but ${WARNINGS} warnings found${NC}"
    exit 0
else
    echo "  ${RED}❌ Found ${ERRORS} errors - please fix before deploying${NC}"
    echo ""
    echo "💡 Tip: Use the standard template:"
    echo "   cp deployments/templates/Dockerfile.go-service services/YOUR_SERVICE/Dockerfile"
    echo "   # Then replace {SERVICE_NAME} with your service name"
    exit 1
fi
