#!/bin/bash

# Deployment Script for Admin Management System
# Usage: ./deploy.sh [staging|production] [--rollback]

set -e

ENVIRONMENT=${1:-staging}
ROLLBACK=${2}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Configuration
NAMESPACE="admin-system-$ENVIRONMENT"
IMAGE_REGISTRY="ghcr.io/your-org"
IMAGE_NAME="admin-system"
DEPLOYMENT_NAME="admin-system-app"

# Get current Git commit hash
GIT_COMMIT=$(git rev-parse --short HEAD)
IMAGE_TAG="${ENVIRONMENT}-${GIT_COMMIT}"

# Validate environment
validate_environment() {
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
        exit 1
    fi
    
    log_info "Deploying to: $ENVIRONMENT"
    log_info "Image tag: $IMAGE_TAG"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local tools=("kubectl" "docker" "git")
    local missing_tools=()
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check if kubectl is configured for the right cluster
    local current_context=$(kubectl config current-context)
    log_info "Current kubectl context: $current_context"
    
    # Verify namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        log_info "Please create the namespace first: kubectl create namespace $NAMESPACE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building and pushing Docker image..."
    
    cd "$PROJECT_ROOT"
    
    # Build the image
    log_info "Building Docker image: $IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    docker build -t "$IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG" .
    
    # Tag as latest for the environment
    docker tag "$IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_REGISTRY/$IMAGE_NAME:$ENVIRONMENT-latest"
    
    # Push the images
    log_info "Pushing Docker images..."
    docker push "$IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    docker push "$IMAGE_REGISTRY/$IMAGE_NAME:$ENVIRONMENT-latest"
    
    log_success "Docker image built and pushed successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    # By default, migrations run on container startup via docker-entrypoint.sh
    local STARTUP_MIGRATIONS=${STARTUP_MIGRATIONS:-true}
    local MIGRATION_PRECHECK=${MIGRATION_PRECHECK:-false}

    if [ "$STARTUP_MIGRATIONS" = "true" ]; then
        log_info "Skipping explicit migration job: startup will run Prisma migrations."
    else
        log_warning "STARTUP_MIGRATIONS is disabled; running explicit Prisma migration job."
        # Prisma migration (idempotent) — resolves DATABASE_URL from config.yaml inside the container
        kubectl run prisma-migrate-$(date +%s) \
            --image="$IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG" \
            --namespace="$NAMESPACE" \
            --restart=Never \
            --rm -i --tty \
            --env-from=secret/app-secrets \
            --env-from=configmap/app-config \
            --command -- sh -lc "/app/docker-entrypoint.sh prisma-migrate-only"
        log_success "Explicit Prisma migration completed"
    fi

    if [ "$MIGRATION_PRECHECK" = "true" ]; then
        log_info "Running migration precheck job (prisma migrate status)..."
        kubectl run migration-check-$(date +%s) \
            --image="$IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG" \
            --namespace="$NAMESPACE" \
            --restart=Never \
            --rm -i --tty \
            --env-from=secret/app-secrets \
            --env-from=configmap/app-config \
            --command -- sh -lc "/app/docker-entrypoint.sh prisma-migrate-status || true"
        log_success "Migration precheck finished"
    fi
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    cd "$PROJECT_ROOT"
    
    # Update deployment with new image
    kubectl set image deployment/$DEPLOYMENT_NAME \
        app="$IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG" \
        --namespace="$NAMESPACE"
    
    # Wait for rollout to complete
    log_info "Waiting for deployment rollout..."
    kubectl rollout status deployment/$DEPLOYMENT_NAME --namespace="$NAMESPACE" --timeout=600s
    
    log_success "Deployment completed successfully"
}

# Perform health check
health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    local health_url=""
    
    if [ "$ENVIRONMENT" = "staging" ]; then
        health_url="https://staging.yourdomain.com/api/health"
    else
        health_url="https://yourdomain.com/api/health"
    fi
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "$health_url" &> /dev/null; then
            log_success "Health check passed!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for application to be healthy..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    cd "$PROJECT_ROOT"
    
    local test_url=""
    if [ "$ENVIRONMENT" = "staging" ]; then
        test_url="https://staging.yourdomain.com"
    else
        test_url="https://yourdomain.com"
    fi
    
    # Run basic smoke tests
    npm run test:smoke -- --baseUrl="$test_url"
    
    log_success "Smoke tests passed"
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    # Get previous revision
    local previous_revision=$(kubectl rollout history deployment/$DEPLOYMENT_NAME --namespace="$NAMESPACE" | tail -2 | head -1 | awk '{print $1}')
    
    if [ -z "$previous_revision" ]; then
        log_error "No previous revision found for rollback"
        exit 1
    fi
    
    log_info "Rolling back to revision: $previous_revision"
    kubectl rollout undo deployment/$DEPLOYMENT_NAME --namespace="$NAMESPACE"
    
    # Wait for rollback to complete
    kubectl rollout status deployment/$DEPLOYMENT_NAME --namespace="$NAMESPACE" --timeout=300s
    
    log_success "Rollback completed successfully"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=""
    
    if [ "$status" = "success" ]; then
        message="✅ Deployment to $ENVIRONMENT successful! Image: $IMAGE_TAG"
    else
        message="❌ Deployment to $ENVIRONMENT failed! Image: $IMAGE_TAG"
    fi
    
    # Send Slack notification if webhook URL is set
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    log_info "Notification sent: $message"
}

# Backup current deployment
backup_deployment() {
    log_info "Creating deployment backup..."
    
    local backup_dir="$PROJECT_ROOT/backups/deployments"
    mkdir -p "$backup_dir"
    
    local backup_file="$backup_dir/deployment-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S).yaml"
    
    kubectl get deployment "$DEPLOYMENT_NAME" --namespace="$NAMESPACE" -o yaml > "$backup_file"
    
    log_info "Deployment backup saved to: $backup_file"
}

# Main deployment function
deploy() {
    log_info "Starting deployment process..."
    
    validate_environment
    check_prerequisites
    
    if [ "$ROLLBACK" = "--rollback" ]; then
        rollback_deployment
        health_check
        send_notification "success"
        return 0
    fi
    
    # Create backup before deployment
    backup_deployment
    
    # Build and push new image
    build_and_push_image
    
    # Run database migrations
    run_migrations
    
    # Deploy to Kubernetes
    deploy_to_kubernetes
    
    # Perform health check
    if ! health_check; then
        log_error "Health check failed, rolling back..."
        rollback_deployment
        send_notification "failure"
        exit 1
    fi
    
    # Run smoke tests
    if ! run_smoke_tests; then
        log_warning "Smoke tests failed, but deployment will continue"
    fi
    
    send_notification "success"
    log_success "Deployment completed successfully!"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if there are uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "There are uncommitted changes in the repository"
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Check if we're on the right branch
    local current_branch=$(git branch --show-current)
    local expected_branch=""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        expected_branch="main"
    else
        expected_branch="develop"
    fi
    
    if [ "$current_branch" != "$expected_branch" ]; then
        log_warning "Current branch ($current_branch) doesn't match expected branch ($expected_branch) for $ENVIRONMENT"
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Production deployment confirmation
    if [ "$ENVIRONMENT" = "production" ]; then
        log_warning "You are about to deploy to PRODUCTION!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Production deployment cancelled"
            exit 0
        fi
    fi
    
    log_success "Pre-deployment checks passed"
}

# Show deployment status
show_status() {
    log_info "Current deployment status:"
    
    echo "Namespace: $NAMESPACE"
    echo "Deployment: $DEPLOYMENT_NAME"
    echo ""
    
    kubectl get deployment "$DEPLOYMENT_NAME" --namespace="$NAMESPACE"
    echo ""
    
    kubectl get pods --namespace="$NAMESPACE" -l app=admin-system-app
    echo ""
    
    log_info "Recent deployment history:"
    kubectl rollout history deployment/$DEPLOYMENT_NAME --namespace="$NAMESPACE"
}

# Show usage
show_usage() {
    echo "Usage: $0 [staging|production] [--rollback|--status]"
    echo ""
    echo "Options:"
    echo "  staging     Deploy to staging environment"
    echo "  production  Deploy to production environment"
    echo "  --rollback  Rollback to previous deployment"
    echo "  --status    Show current deployment status"
    echo ""
    echo "Examples:"
    echo "  $0 staging                 # Deploy to staging"
    echo "  $0 production              # Deploy to production"
    echo "  $0 staging --rollback      # Rollback staging deployment"
    echo "  $0 production --status     # Show production status"
    echo ""
}

# Main script logic
main() {
    case "${2:-}" in
        --status)
            show_status
            ;;
        --rollback)
            pre_deployment_checks
            deploy
            ;;
        "")
            pre_deployment_checks
            deploy
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Check if arguments provided
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

# Run main function
main "$@"
