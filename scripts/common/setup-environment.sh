#!/bin/bash

# Environment Setup Script for Admin Management System
# Usage: ./setup-environment.sh [development|staging|production]

set -e

ENVIRONMENT=${1:-development}
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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("node" "npm" "docker" "docker-compose")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and try again."
        exit 1
    fi
    
    log_success "All dependencies are installed"
}

# Setup Node.js environment
setup_node() {
    log_info "Setting up Node.js environment..."
    
    cd "$PROJECT_ROOT"
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="22.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION is not supported. Please install Node.js $REQUIRED_VERSION or higher."
        exit 1
    fi
    
    # Install dependencies
    log_info "Installing Node.js dependencies..."
    npm ci
    
    log_success "Node.js environment setup complete"
}

# Setup environment variables
setup_env_vars() {
    log_info "Setting up environment variables for $ENVIRONMENT..."
    
    local env_file=""
    case $ENVIRONMENT in
        development)
            env_file=".env.local"
            ;;
        staging)
            env_file=".env.staging"
            ;;
        production)
            env_file=".env.production"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    if [ ! -f "$PROJECT_ROOT/$env_file" ]; then
        log_info "Creating $env_file from template..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/$env_file"
        log_warning "Please update $env_file with your actual configuration values"
    else
        log_info "$env_file already exists"
    fi
    
    # Validate required environment variables
    source "$PROJECT_ROOT/$env_file"
    
    local required_vars=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_info "Please update $env_file with the missing variables"
        exit 1
    fi
    
    log_success "Environment variables setup complete"
}

# Setup database
setup_database() {
    log_info "Setting up database..."
    
    cd "$PROJECT_ROOT"
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate
    
    if [ "$ENVIRONMENT" = "development" ]; then
        # Start database with Docker Compose
        log_info "Starting database services..."
        docker-compose -f docker-compose.dev.yml up -d postgres redis
        
        # Wait for database to be ready
        log_info "Waiting for database to be ready..."
        sleep 10
        
        # Run migrations
        log_info "Running database migrations..."
        npx prisma migrate dev --name init
        
        # Seed database
        log_info "Seeding database..."
        npx prisma db seed
    else
        # For staging/production, just run migrations
        log_info "Running database migrations..."
        npx prisma migrate deploy
    fi
    
    log_success "Database setup complete"
}

# Setup Docker environment
setup_docker() {
    log_info "Setting up Docker environment..."
    
    cd "$PROJECT_ROOT"
    
    case $ENVIRONMENT in
        development)
            log_info "Starting development services..."
            docker-compose -f docker-compose.dev.yml up -d
            ;;
        staging|production)
            log_info "Building production Docker image..."
            docker build -t admin-system:latest .
            
            log_info "Starting production services..."
            docker-compose up -d
            ;;
    esac
    
    log_success "Docker environment setup complete"
}

# Setup monitoring
setup_monitoring() {
    if [ "$ENVIRONMENT" != "development" ]; then
        log_info "Setting up monitoring..."
        
        # Create monitoring directories
        mkdir -p "$PROJECT_ROOT/monitoring/prometheus"
        mkdir -p "$PROJECT_ROOT/monitoring/grafana/provisioning/dashboards"
        mkdir -p "$PROJECT_ROOT/monitoring/grafana/provisioning/datasources"
        
        # Copy monitoring configurations
        if [ ! -f "$PROJECT_ROOT/monitoring/prometheus.yml" ]; then
            cat > "$PROJECT_ROOT/monitoring/prometheus.yml" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert.rules.yml"

scrape_configs:
  - job_name: 'admin-system'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
EOF
        fi
        
        log_success "Monitoring setup complete"
    fi
}

# Setup SSL certificates (for production)
setup_ssl() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Setting up SSL certificates..."
        
        # Create SSL directory
        mkdir -p "$PROJECT_ROOT/nginx/ssl"
        
        if [ ! -f "$PROJECT_ROOT/nginx/ssl/cert.pem" ]; then
            log_warning "SSL certificates not found. Please add your SSL certificates to nginx/ssl/"
            log_info "Required files:"
            log_info "  - nginx/ssl/cert.pem (certificate)"
            log_info "  - nginx/ssl/key.pem (private key)"
        fi
        
        log_success "SSL setup complete"
    fi
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            log_success "Application is healthy!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for application to start..."
        sleep 5
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    if [ "$ENVIRONMENT" = "development" ]; then
        docker-compose -f docker-compose.dev.yml down
    else
        docker-compose down
    fi
}

# Main setup function
main() {
    log_info "Starting environment setup for: $ENVIRONMENT"
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    check_dependencies
    setup_node
    setup_env_vars
    setup_database
    setup_docker
    setup_monitoring
    setup_ssl
    
    # Wait a bit for services to start
    sleep 10
    
    if health_check; then
        log_success "Environment setup completed successfully!"
        log_info "Application is running at: http://localhost:3000"
        
        if [ "$ENVIRONMENT" != "development" ]; then
            log_info "Monitoring is available at: http://localhost:3001"
        fi
    else
        log_error "Environment setup completed but health check failed"
        exit 1
    fi
}

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 [development|staging|production]"
    echo ""
    echo "This script sets up the Admin Management System environment."
    echo ""
    echo "Environments:"
    echo "  development  - Local development environment with hot reload"
    echo "  staging      - Staging environment for testing"
    echo "  production   - Production environment with full monitoring"
    echo ""
    exit 1
fi

# Run main function
main "$@"
