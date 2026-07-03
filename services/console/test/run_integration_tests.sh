#!/bin/bash

# Integration Test Runner for Console Service
# This script runs integration tests against the preview environment Supabase database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Console Service Integration Tests ===${NC}"
echo ""

# Check if Supabase credentials file exists
if [ ! -f "../../secrets/supabase-credentials.json" ]; then
    echo -e "${RED}Error: Supabase credentials file not found${NC}"
    echo "Expected: ../../secrets/supabase-credentials.json"
    exit 1
fi

# Extract database password from credentials file
DB_PASSWORD=$(jq -r '.db_password' ../../secrets/supabase-credentials.json)

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Could not extract database password from credentials${NC}"
    exit 1
fi

# Export environment variable for tests
export SUPABASE_DB_PASSWORD="$DB_PASSWORD"

echo -e "${YELLOW}Database Connection:${NC}"
echo "  Host: aws-1-ap-northeast-1.pooler.supabase.com"
echo "  Database: postgres"
echo "  User: postgres.YOUR_SUPABASE_PROJECT"
echo ""

# Check if running in short mode
if [ "$1" == "--short" ]; then
    echo -e "${YELLOW}Running in short mode (skipping integration tests)${NC}"
    go test -v -short ./...
    exit 0
fi

echo -e "${GREEN}Running Integration Tests...${NC}"
echo ""

# Run integration tests with verbose output
# Use -count=1 to disable test caching
# Integration tests are identified by checking testing.Short() in the code
go test -v -count=1 ./test/

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All integration tests passed!${NC}"
else
    echo -e "${RED}❌ Some integration tests failed${NC}"
    exit $TEST_EXIT_CODE
fi

# Optional: Run with coverage
if [ "$1" == "--coverage" ]; then
    echo ""
    echo -e "${GREEN}Generating coverage report...${NC}"
    go test -v -count=1 -coverprofile=integration_coverage.out ./test/
    go tool cover -html=integration_coverage.out -o integration_coverage.html
    echo -e "${GREEN}Coverage report generated: integration_coverage.html${NC}"
fi
