#!/bin/bash

# Docker build script with optimization and security scanning
set -e

# Configuration
IMAGE_NAME="admin-management-system"
REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
VERSION="${VERSION:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Docker Build Script for Admin Management System

Usage: $0 [OPTIONS]

Options:
    -e, --environment   Environment (development|staging|production) [default: production]
    -v, --version      Version tag [default: latest]
    -r, --registry     Docker registry [default: localhost:5000]
    -n, --name         Image name [default: admin-management-system]
    -s, --scan         Run security scan after build
    -p, --push         Push to registry after build
    -c, --cache        Use build cache [default: true]
    --no-cache         Disable build cache
    --multi-arch       Build for multiple architectures
    -h, --help         Show this help message

Examples:
    $0 --environment production --version 1.0.0 --push
    $0 --environment development --no-cache
    $0 --multi-arch --scan --push

EOF
}

# Parse command line arguments
PUSH=false
SCAN=false
USE_CACHE=true
MULTI_ARCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -s|--scan)
            SCAN=true
            shift
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -c|--cache)
            USE_CACHE=true
            shift
            ;;
        --no-cache)
            USE_CACHE=false
            shift
            ;;
        --multi-arch)
            MULTI_ARCH=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    log_info "Valid environments: development, staging, production"
    exit 1
fi

# Set image tags
FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"
IMAGE_TAG="${FULL_IMAGE_NAME}:${VERSION}"
LATEST_TAG="${FULL_IMAGE_NAME}:latest"
ENV_TAG="${FULL_IMAGE_NAME}:${ENVIRONMENT}"

log_info "Starting Docker build process..."
log_info "Environment: $ENVIRONMENT"
log_info "Image: $IMAGE_TAG"
log_info "Registry: $REGISTRY"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running or not accessible"
    exit 1
fi

# Check if required files exist
DOCKERFILE="Dockerfile"
if [[ "$ENVIRONMENT" == "development" ]]; then
    DOCKERFILE="Dockerfile.dev"
fi

if [[ ! -f "$DOCKERFILE" ]]; then
    log_error "Dockerfile not found: $DOCKERFILE"
    exit 1
fi

if [[ ! -f "package.json" ]]; then
    log_error "package.json not found"
    exit 1
fi

# Create .dockerignore if it doesn't exist
if [[ ! -f ".dockerignore" ]]; then
    log_warning ".dockerignore not found, creating default one..."
    cat > .dockerignore << EOF
node_modules
npm-debug.log*
.next
.env*
.git
.gitignore
README.md
Dockerfile*
docker-compose*
.dockerignore
coverage
.nyc_output
.cache
.vscode
.idea
*.log
logs
*.tgz
*.tar.gz
.DS_Store
Thumbs.db
EOF
fi

# Prepare build arguments
BUILD_ARGS=""
BUILD_ARGS="$BUILD_ARGS --build-arg NODE_ENV=$ENVIRONMENT"
BUILD_ARGS="$BUILD_ARGS --build-arg NEXT_TELEMETRY_DISABLED=1"

if [[ -n "$DATABASE_URL" ]]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg DATABASE_URL=$DATABASE_URL"
fi

# Cache options
CACHE_ARGS=""
if [[ "$USE_CACHE" == "true" ]]; then
    CACHE_ARGS="--cache-from $IMAGE_TAG"
else
    CACHE_ARGS="--no-cache"
fi

# Multi-architecture build
if [[ "$MULTI_ARCH" == "true" ]]; then
    log_info "Building for multiple architectures..."
    
    # Check if buildx is available
    if ! docker buildx version > /dev/null 2>&1; then
        log_error "Docker buildx is required for multi-architecture builds"
        exit 1
    fi
    
    # Create builder if it doesn't exist
    if ! docker buildx inspect multiarch-builder > /dev/null 2>&1; then
        log_info "Creating multi-architecture builder..."
        docker buildx create --name multiarch-builder --use
    else
        docker buildx use multiarch-builder
    fi
    
    # Build for multiple platforms
    PLATFORMS="linux/amd64,linux/arm64"
    
    if [[ "$PUSH" == "true" ]]; then
        docker buildx build \
            --platform $PLATFORMS \
            --file $DOCKERFILE \
            $BUILD_ARGS \
            --tag $IMAGE_TAG \
            --tag $ENV_TAG \
            --push \
            .
    else
        docker buildx build \
            --platform $PLATFORMS \
            --file $DOCKERFILE \
            $BUILD_ARGS \
            --tag $IMAGE_TAG \
            --tag $ENV_TAG \
            --load \
            .
    fi
else
    # Standard build
    log_info "Building Docker image..."
    
    docker build \
        --file $DOCKERFILE \
        $BUILD_ARGS \
        $CACHE_ARGS \
        --tag $IMAGE_TAG \
        --tag $ENV_TAG \
        .
    
    # Tag as latest for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker tag $IMAGE_TAG $LATEST_TAG
    fi
fi

log_success "Docker image built successfully: $IMAGE_TAG"

# Get image size
IMAGE_SIZE=$(docker images --format "table {{.Size}}" $IMAGE_TAG | tail -n 1)
log_info "Image size: $IMAGE_SIZE"

# Security scanning
if [[ "$SCAN" == "true" ]]; then
    log_info "Running security scan..."
    
    # Check if trivy is available
    if command -v trivy > /dev/null 2>&1; then
        log_info "Scanning with Trivy..."
        trivy image --severity HIGH,CRITICAL $IMAGE_TAG
        
        # Save scan results
        SCAN_REPORT="security-scan-$(date +%Y%m%d-%H%M%S).json"
        trivy image --format json --output $SCAN_REPORT $IMAGE_TAG
        log_info "Scan report saved: $SCAN_REPORT"
    else
        log_warning "Trivy not found, skipping security scan"
        log_info "Install Trivy: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
    fi
fi

# Test the image
log_info "Testing the built image..."

# Start a test container
TEST_CONTAINER="test-${IMAGE_NAME}-$(date +%s)"
docker run -d --name $TEST_CONTAINER -p 3001:3000 $IMAGE_TAG

# Wait for container to start
sleep 10

# Test health endpoint
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    log_success "Health check passed"
else
    log_warning "Health check failed or endpoint not available"
fi

# Cleanup test container
docker stop $TEST_CONTAINER > /dev/null 2>&1
docker rm $TEST_CONTAINER > /dev/null 2>&1

# Push to registry
if [[ "$PUSH" == "true" && "$MULTI_ARCH" != "true" ]]; then
    log_info "Pushing to registry..."
    
    docker push $IMAGE_TAG
    docker push $ENV_TAG
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker push $LATEST_TAG
    fi
    
    log_success "Images pushed to registry"
fi

# Cleanup old images (keep last 5 versions)
log_info "Cleaning up old images..."
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" \
    | grep "^${FULL_IMAGE_NAME}:" \
    | sort -k2 -r \
    | tail -n +6 \
    | awk '{print $1}' \
    | xargs -r docker rmi > /dev/null 2>&1 || true

# Summary
log_success "Build completed successfully!"
echo
echo "Image Details:"
echo "  Name: $IMAGE_TAG"
echo "  Environment: $ENVIRONMENT"
echo "  Size: $IMAGE_SIZE"
echo "  Registry: $REGISTRY"
echo
echo "Next steps:"
if [[ "$PUSH" == "true" ]]; then
    echo "  - Image has been pushed to registry"
    echo "  - Deploy using: docker run -p 3000:3000 $IMAGE_TAG"
else
    echo "  - Test locally: docker run -p 3000:3000 $IMAGE_TAG"
    echo "  - Push to registry: docker push $IMAGE_TAG"
fi
echo "  - View logs: docker logs <container_id>"
echo "  - Health check: curl http://localhost:3000/api/health"