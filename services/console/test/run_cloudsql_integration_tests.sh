#!/bin/bash

# Cloud SQL Integration Test Runner for Console Service
# This script runs integration tests against Cloud SQL database via Cloud SQL Proxy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Console Service Cloud SQL Integration Tests ===${NC}"
echo ""

# Cloud SQL instance connection name
INSTANCE_CONNECTION_NAME="${GCP_PROJECT_ID}:asia-northeast1:gm"
PROXY_PORT=5432

# Check if Cloud SQL Proxy is installed
if ! command -v cloud-sql-proxy &> /dev/null; then
    echo -e "${RED}Error: Cloud SQL Proxy is not installed${NC}"
    echo ""
    echo "Install it with:"
    echo "  brew install cloud-sql-proxy"
    echo "  # or"
    echo "  curl -o cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.darwin.amd64"
    echo "  chmod +x cloud-sql-proxy"
    exit 1
fi

# Get database password from Secret Manager
echo -e "${BLUE}Fetching database password from Secret Manager...${NC}"
DB_PASSWORD=$(gcloud secrets versions access latest --secret="DATABASE_URL" --project=${GCP_PROJECT_ID} | grep -oP 'postgres:\K[^@]+' | sed 's/%24/$/g; s/%28/(/g; s/%29/)/g; s/%7E/~/g; s/%5D/]/g; s/%5B/[/g')

if [ -z "$DB_PASSWORD" ]; then
    # Fallback: extract from full URL and decode
    FULL_URL=$(gcloud secrets versions access latest --secret="DATABASE_URL" --project=${GCP_PROJECT_ID})
    DB_PASSWORD=$(echo "$FULL_URL" | sed -n 's/.*postgres:\([^@]*\)@.*/\1/p' | python3 -c "import sys; from urllib.parse import unquote; print(unquote(sys.stdin.read().strip()))")
fi

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Could not extract database password from SECRET${NC}"
    exit 1
fi

export CLOUDSQL_DB_PASSWORD="$DB_PASSWORD"

echo -e "${BLUE}Database Connection:${NC}"
echo "  Instance: $INSTANCE_CONNECTION_NAME"
echo "  Database: gm_db"
echo "  Proxy Port: $PROXY_PORT"
echo ""

# Check if Cloud SQL Proxy is already running
if lsof -Pi :$PROXY_PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}Cloud SQL Proxy already running on port $PROXY_PORT${NC}"
    PROXY_ALREADY_RUNNING=true
else
    echo -e "${BLUE}Starting Cloud SQL Proxy...${NC}"
    cloud-sql-proxy "$INSTANCE_CONNECTION_NAME" --port "$PROXY_PORT" &
    PROXY_PID=$!
    PROXY_ALREADY_RUNNING=false

    # Wait for proxy to be ready
    echo -n "Waiting for proxy to be ready"
    for i in {1..30}; do
        if lsof -Pi :$PROXY_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}Cloud SQL Proxy is ready!${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done

    if ! lsof -Pi :$PROXY_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo ""
        echo -e "${RED}Cloud SQL Proxy failed to start${NC}"
        kill $PROXY_PID 2>/dev/null || true
        exit 1
    fi
fi

echo ""

# Cleanup function
cleanup() {
    if [ "$PROXY_ALREADY_RUNNING" = false ] && [ ! -z "$PROXY_PID" ]; then
        echo ""
        echo -e "${BLUE}Stopping Cloud SQL Proxy...${NC}"
        kill $PROXY_PID 2>/dev/null || true
        wait $PROXY_PID 2>/dev/null || true
        echo -e "${GREEN}Cloud SQL Proxy stopped${NC}"
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Check if running in short mode
if [ "$1" == "--short" ]; then
    echo -e "${YELLOW}Running in short mode (skipping integration tests)${NC}"
    go test -v -short ./...
    exit 0
fi

echo -e "${GREEN}Running Cloud SQL Integration Tests...${NC}"
echo ""

# Run integration tests with verbose output
# Use -count=1 to disable test caching
# Use custom build tag to select Cloud SQL tests
go test -v -count=1 -tags=cloudsql ./test/

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All Cloud SQL integration tests passed!${NC}"
else
    echo -e "${RED}❌ Some integration tests failed${NC}"
    exit $TEST_EXIT_CODE
fi

# Optional: Run with coverage
if [ "$1" == "--coverage" ]; then
    echo ""
    echo -e "${GREEN}Generating coverage report...${NC}"
    go test -v -count=1 -tags=cloudsql -coverprofile=cloudsql_coverage.out ./test/
    go tool cover -html=cloudsql_coverage.out -o cloudsql_coverage.html
    echo -e "${GREEN}Coverage report generated: cloudsql_coverage.html${NC}"
fi
