#!/bin/bash

# Optimized Docker Build Script with Compatibility Checks
# This script builds the Docker image with proper Playwright compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting optimized Docker build process...${NC}"

# Build arguments
NODE_VERSION=${NODE_VERSION:-"22"}
IMAGE_TAG=${IMAGE_TAG:-"ghcr.io/ScientificInternet/url-batch-checker:optimized-$(date +%Y%m%d-%H%M%S)"}

echo -e "${YELLOW}📋 Build configuration:${NC}"
echo "  - Node.js version: $NODE_VERSION"
echo "  - Image tag: $IMAGE_TAG"
echo ""

# Clean up any existing builds
echo -e "${YELLOW}🧹 Cleaning up previous builds...${NC}"
docker system prune -f > /dev/null 2>&1

# Build the Docker image with BuildKit
echo -e "${YELLOW}🏗️  Building Docker image...${NC}"
DOCKER_BUILDKIT=1 docker build \
    --file Dockerfile.production \
    --tag "$IMAGE_TAG" \
    --build-arg NODE_VERSION="$NODE_VERSION" \
    --build-arg NEXT_TELEMETRY_DISABLED=1 \
    --build-arg NODE_ENV=production \
    --progress=plain \
    . 2>&1 | tee build.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Docker build completed successfully!${NC}"
else
    echo -e "${RED}❌ Docker build failed!${NC}"
    echo "Check build.log for details"
    exit 1
fi

# Test the built image
echo -e "${YELLOW}🧪 Testing the built image...${NC}"
echo -e "${YELLOW}   - Checking image size...${NC}"
docker images "$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

echo -e "${YELLOW}   - Running compatibility check...${NC}"
docker run --rm \
    -e PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright \
    "$IMAGE_TAG" \
    /app/compatibility-check.sh

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image compatibility check passed!${NC}"
else
    echo -e "${RED}❌ Image compatibility check failed!${NC}"
    exit 1
fi

# Tag the image for production
echo -e "${YELLOW}🏷️  Tagging image for production...${NC}"
docker tag "$IMAGE_TAG" ghcr.io/ScientificInternet/url-batch-checker:prod-latest

echo -e "${GREEN}🎉 Build process completed successfully!${NC}"
echo ""
echo "Available tags:"
echo "  - $IMAGE_TAG"
echo "  - ghcr.io/ScientificInternet/url-batch-checker:prod-latest"
echo ""
echo "To run the container:"
echo "  docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "To check logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Note: The new Dockerfile.production doesn't require standalone output mode"
