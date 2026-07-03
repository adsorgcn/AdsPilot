#!/bin/bash

# Docker Build Script with GA Support
# This script builds the Docker image with proper environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Docker build with GA support...${NC}"

# Build arguments
NODE_VERSION=${NODE_VERSION:-"22"}
IMAGE_TAG=${IMAGE_TAG:-"ghcr.io/ScientificInternet/url-batch-checker:ga-$(date +%Y%m%d-%H%M%S)"}
NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID:-""}

if [ -z "$NEXT_PUBLIC_GA_ID" ]; then
    echo -e "${YELLOW}⚠️  NEXT_PUBLIC_GA_ID is not set! GA will not work.${NC}"
    echo -e "${YELLOW}   Set it with: export NEXT_PUBLIC_GA_ID=G-F1HVLMDMV0${NC}"
    echo ""
fi

echo -e "${YELLOW}📋 Build configuration:${NC}"
echo "  - Node.js version: $NODE_VERSION"
echo "  - Image tag: $IMAGE_TAG"
echo "  - NEXT_PUBLIC_GA_ID: ${NEXT_PUBLIC_GA_ID:-'[NOT SET]'}"
echo ""

# Clean up any existing builds
echo -e "${YELLOW}🧹 Cleaning up previous builds...${NC}"
docker system prune -f > /dev/null 2>&1

# Build the Docker image with BuildKit
echo -e "${YELLOW}🏗️  Building Docker image...${NC}"
DOCKER_BUILDKIT=1 docker build \
    --file Dockerfile \
    --tag "$IMAGE_TAG" \
    --build-arg NODE_VERSION="$NODE_VERSION" \
    --build-arg NEXT_TELEMETRY_DISABLED=1 \
    --build-arg NODE_ENV=production \
    --build-arg NEXT_PUBLIC_GA_ID="$NEXT_PUBLIC_GA_ID" \
    --progress=plain \
    . 2>&1 | tee build-ga.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Docker build completed successfully!${NC}"
else
    echo -e "${RED}❌ Docker build failed!${NC}"
    echo "Check build-ga.log for details"
    exit 1
fi

# Tag the image for production
echo -e "${YELLOW}🏷️  Tagging image for production...${NC}"
docker tag "$IMAGE_TAG" ghcr.io/ScientificInternet/url-batch-checker:ga-latest

echo -e "${GREEN}🎉 Build process completed successfully!${NC}"
echo ""
echo "Available tags:"
echo "  - $IMAGE_TAG"
echo "  - ghcr.io/ScientificInternet/url-batch-checker:ga-latest"
echo ""
echo "To run the container:"
echo "  docker run -p 3000:3000 ghcr.io/ScientificInternet/url-batch-checker:ga-latest"
echo ""
echo "To test GA:"
echo "  Open http://localhost:3000/ga-test"
echo ""
