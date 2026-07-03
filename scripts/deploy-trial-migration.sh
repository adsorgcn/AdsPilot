#!/bin/bash

# Trial Subscriptions Data Migration Deployment Script
# Deploys and executes trial subscriptions migration from useractivity to billing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${REGION:-asia-east1}"
BUILD_ID="${BUILD_ID:-$(date +%Y%m%d-%H%M%S)}"

echo -e "${BLUE}=== Trial Subscriptions Data Migration ===${NC}"
echo -e "Project: ${YELLOW}$PROJECT_ID${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Build ID: ${YELLOW}$BUILD_ID${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    print_success "All dependencies found"
}

# Verify project and permissions
verify_project() {
    print_status "Verifying project and permissions..."

    # Check if project exists
    if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
        print_error "Project $PROJECT_ID does not exist or you don't have access"
        exit 1
    fi

    # Check required APIs
    REQUIRED_APIS=(
        "run.googleapis.com"
        "cloudbuild.googleapis.com"
        "sqladmin.googleapis.com"
        "secretmanager.googleapis.com"
    )

    for api in "${REQUIRED_APIS[@]}"; do
        if ! gcloud services list --enabled --project="$PROJECT_ID" | grep -q "$api"; then
            print_warning "Enabling required API: $api"
            gcloud services enable "$api" --project="$PROJECT_ID"
        fi
    done

    print_success "Project verification completed"
}

# Build and deploy migration
deploy_migration() {
    print_status "Building and deploying trial subscriptions migration..."

    cd services/billing

    # Build the migration image
    print_status "Building billing migrator image..."
    gcloud builds submit \
        --config=cloudbuild-trial-migration.yaml \
        --substitutions=BUILD_ID="$BUILD_ID" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        .

    print_success "Migration image built and deployed"
}

# Monitor migration execution
monitor_migration() {
    print_status "Monitoring trial subscriptions migration execution..."

    # Wait for migration job to complete
    JOB_NAME="billing-trial-migrator-$BUILD_ID"

    print_status "Migration job name: $JOB_NAME"
    print_status "Waiting for migration to complete..."

    # Monitor job execution
    for i in {1..60}; do
        STATUS=$(gcloud run jobs describe "$JOB_NAME" \
            --region="$REGION" \
            --format="value(lastExecutionCompletedAt)" \
            --project="$PROJECT_ID" 2>/dev/null || echo "")

        if [[ -n "$STATUS" ]]; then
            print_success "Migration job completed"
            break
        fi

        if [[ $i -eq 60 ]]; then
            print_error "Migration job timed out after 30 minutes"
            exit 1
        fi

        echo -n "."
        sleep 30
    done
    echo ""

    # Check job execution results
    print_status "Checking migration results..."

    EXECUTION_ID=$(gcloud run jobs executions list "$JOB_NAME" \
        --region="$REGION" \
        --limit=1 \
        --format="value(name)" \
        --project="$PROJECT_ID" 2>/dev/null || echo "")

    if [[ -n "$EXECUTION_ID" ]]; then
        TASK_STATUS=$(gcloud run jobs executions describe "$EXECUTION_ID" \
            --region="$REGION" \
            --format="value(status)" \
            --project="$PROJECT_ID" 2>/dev/null || echo "Unknown")

        print_success "Migration execution status: $TASK_STATUS"

        # Get logs
        print_status "Fetching migration logs..."
        gcloud run jobs executions logs "$EXECUTION_ID" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --limit=50
    else
        print_warning "Could not retrieve execution details"
    fi
}

# Verify migration results
verify_migration() {
    print_status "Verifying migration results..."

    print_warning "Manual verification required:"
    echo "1. Check billing.subscriptions table for trial records"
    echo "2. Verify useractivity.trial_subscriptions backup was created"
    echo "3. Confirm trial subscriptions have correct status and dates"
    echo ""
    echo "SQL queries for verification:"
    echo "-- Count migrated trial subscriptions:"
    echo "SELECT COUNT(*) FROM billing.subscriptions WHERE status = 'trial';"
    echo ""
    echo "-- Check recent trial subscriptions:"
    echo "SELECT id, \"userId\", plan, status, \"trialStartDate\", \"trialEndDate\" "
    echo "FROM billing.subscriptions WHERE status = 'trial' ORDER BY \"createdAt\" DESC LIMIT 10;"
    echo ""
    echo "-- Check backup tables:"
    echo "SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'trial_subscriptions_backup_%';"
}

# Main execution
main() {
    print_status "Starting trial subscriptions data migration deployment..."

    check_dependencies
    verify_project
    deploy_migration
    monitor_migration
    verify_migration

    print_success "Trial subscriptions data migration deployment completed!"
    echo ""
    print_status "Next steps:"
    echo "1. Verify migration results using the SQL queries provided above"
    echo "2. Test trial subscription functionality in the application"
    echo "3. Monitor billing service logs for any issues"
    echo "4. Update useractivity service to use billing service for trial subscriptions"
}

# Run main function
main "$@"