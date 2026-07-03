#!/bin/bash

# Basic Connectivity Test Runner
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"

# Ensure test results directory exists
mkdir -p "$TEST_RESULTS_DIR"

echo -e "${BLUE}🌐 Basic Connectivity Test Runner${NC}"
echo "==================================="
echo "Project Root: $PROJECT_ROOT"
echo "Results Dir: $TEST_RESULTS_DIR"
echo ""

echo -e "${BLUE}🔍 Testing basic environment connectivity...${NC}"

# Run the basic connectivity test
TEST_FILE="$SCRIPT_DIR/tests/test-basic-connectivity.mjs"
if [ -f "$TEST_FILE" ]; then
    echo -e "${BLUE}📁 Test file: $TEST_FILE${NC}"

    if node "$TEST_FILE" 2>"$TEST_RESULTS_DIR/basic-connectivity.log"; then
        echo -e "${GREEN}✅ Basic connectivity tests passed!${NC}"
        echo ""
        echo -e "${BLUE}🎯 Environment is ready for Demo Data testing.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Basic connectivity tests failed!${NC}"
        echo -e "${YELLOW}📄 Check logs: $TEST_RESULTS_DIR/basic-connectivity.log${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Test file not found: $TEST_FILE${NC}"
    exit 1
fi