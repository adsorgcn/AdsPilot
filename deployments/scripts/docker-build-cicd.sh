#!/bin/bash

# Optimized Docker Build Script with CI/CD Integration
# This script provides local build optimization similar to the CI/CD pipeline

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NODE_VERSION=${NODE_VERSION:-"22"}
REGISTRY=${REGISTRY:-"ghcr.io"}
IMAGE_NAME=${IMAGE_NAME:-"ScientificInternet/url-batch-checker"}
PLATFORMS=${PLATFORMS:-"linux/amd64,linux/arm64"}
BUILD_TYPE=${BUILD_TYPE:-"production"} # production, optimized, dev

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -h, --help              Show this help message"
            echo "  -t, --tag TAG           Specify image tag"
            echo "  -p, --platforms PLAT   Comma-separated platforms (default: linux/amd64,linux/arm64)"
            echo "  -b, --build-type TYPE   Build type: production, optimized, dev (default: production)"
            echo "  -r, --registry REG      Container registry (default: ghcr.io)"
            echo "  -n, --node-version VER  Node.js version (default: 18)"
            echo "  --no-cache              Disable build cache"
            echo "  --push                  Push image to registry"
            echo "  --sbom                  Generate SBOM"
            echo ""
            echo "Examples:"
            echo "  $0 -t my-app:latest"
            echo "  $0 -b optimized --push"
            echo "  $0 -t v1.0.0 --push --sbom"
            exit 0
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -p|--platforms)
            PLATFORMS="$2"
            shift 2
            ;;
        -b|--build-type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -n|--node-version)
            NODE_VERSION="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --push)
            PUSH_IMAGE=true
            shift
            ;;
        --sbom)
            GENERATE_SBOM=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Set default image tag if not specified
if [ -z "$IMAGE_TAG" ]; then
    IMAGE_TAG="${REGISTRY}/${IMAGE_NAME}:${BUILD_TYPE}-$(date +%Y%m%d-%H%M%S)"
fi

# Set Dockerfile based on build type
case $BUILD_TYPE in
    production)
        DOCKERFILE="Dockerfile.production"
        ;;
    optimized)
        DOCKERFILE="Dockerfile.optimized"
        ;;
    dev)
        DOCKERFILE="Dockerfile.dev"
        ;;
    *)
        echo -e "${RED}Invalid build type: $BUILD_TYPE${NC}"
        exit 1
        ;;
esac

# Build commands
BUILD_CMD="docker buildx build"
BUILD_ARGS=(
    --file "$PROJECT_DIR/$DOCKERFILE"
    --tag "$IMAGE_TAG"
    --platform "$PLATFORMS"
    --build-arg "NODE_VERSION=$NODE_VERSION"
    --build-arg "NEXT_TELEMETRY_DISABLED=1"
    --build-arg "NODE_ENV=production"
    --build-arg "BUILDKIT_INLINE_CACHE=1"
    --progress "plain"
)

# Add cache configuration if not disabled
if [ "$NO_CACHE" != "true" ]; then
    # Cache configuration
    BUILD_ARGS+=(
        --cache-from "type=registry,ref=${REGISTRY}/${IMAGE_NAME}:preview-latest"
        --cache-from "type=registry,ref=${REGISTRY}/${IMAGE_NAME}:prod-latest"
        --cache-to "type=inline,mode=max"
    )
    
    # Local cache directory
    CACHE_DIR="$PROJECT_DIR/.buildx-cache"
    mkdir -p "$CACHE_DIR"
    
    BUILD_ARGS+=(
        --cache-from "type=local,src=$CACHE_DIR"
        --cache-to "type=local,dest=$CACHE_DIR-new,mode=max"
    )
fi

# Add push flag if specified
if [ "$PUSH_IMAGE" = "true" ]; then
    BUILD_ARGS+=(--push)
fi

# Build the image
echo -e "${GREEN}🚀 Starting optimized Docker build...${NC}"
echo -e "${BLUE}Configuration:${NC}"
echo "  - Build Type: $BUILD_TYPE"
echo "  - Dockerfile: $DOCKERFILE"
echo "  - Image Tag: $IMAGE_TAG"
echo "  - Platforms: $PLATFORMS"
echo "  - Node Version: $NODE_VERSION"
echo "  - Registry: $REGISTRY"
echo "  - Cache: $([ "$NO_CACHE" = "true" ] && echo "Disabled" || echo "Enabled")"
echo "  - Push: $([ "$PUSH_IMAGE" = "true" ] && echo "Yes" || echo "No")"
echo ""

# Pre-build cleanup
echo -e "${YELLOW}🧹 Preparing build environment...${NC}"
cd "$PROJECT_DIR"

# Clean up old cache if exists
if [ -d "$CACHE_DIR-new" ]; then
    rm -rf "$CACHE_DIR-new"
fi

# Build the image
echo -e "${YELLOW}🏗️  Building Docker image...${NC}"
set +e
BUILD_OUTPUT=$($BUILD_CMD "${BUILD_ARGS[@]}" . 2>&1)
BUILD_EXIT_CODE=$?
set -e

# Move cache for next build
if [ "$NO_CACHE" != "true" ] && [ -d "$CACHE_DIR-new" ]; then
    rm -rf "$CACHE_DIR"
    mv "$CACHE_DIR-new" "$CACHE_DIR"
fi

# Check build result
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Docker build completed successfully!${NC}"
    
    # Show image information
    echo -e "${YELLOW}📊 Image Information:${NC}"
    docker images "$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    # Generate SBOM if requested
    if [ "$GENERATE_SBOM" = "true" ]; then
        echo -e "${YELLOW}📋 Generating SBOM...${NC}"
        docker buildx imagetools inspect "$IMAGE_TAG" --format '{{json .SBOM}}' > "sbom-$(date +%Y%m%d-%H%M%S).json"
        echo -e "${GREEN}✅ SBOM generated successfully!${NC}"
    fi
    
    # Test the image if not pushed
    if [ "$PUSH_IMAGE" != "true" ]; then
        echo -e "${YELLOW}🧪 Testing the image...${NC}"
        
        # Run basic health check
        if docker run --rm "$IMAGE_TAG" curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Health check passed!${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check failed (expected if running locally)${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Build process completed!${NC}"
    echo ""
    echo "To run the image:"
    echo "  docker run -p 3000:3000 $IMAGE_TAG"
    echo ""
    echo "To push to registry:"
    echo "  docker push $IMAGE_TAG"
    echo ""
    echo "To use with Docker Compose:"
    echo "  IMAGE_TAG=$IMAGE_TAG docker-compose up -d"
    
else
    echo -e "${RED}❌ Docker build failed!${NC}"
    echo ""
    echo "Error output:"
    echo "$BUILD_OUTPUT"
    exit 1
fi

# Show build statistics if available
if command -v docker buildx &> /dev/null; then
    echo ""
    echo -e "${BLUE}📈 Build Statistics:${NC}"
    echo "  - Build time: $(docker ps -a --filter "ancestor=$IMAGE_TAG" --format "{{.CreatedAt}}" | head -1)"
    echo "  - Image size: $(docker images "$IMAGE_TAG" --format "{{.Size}}")"
fi
