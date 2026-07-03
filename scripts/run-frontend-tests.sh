#!/bin/bash

# Frontend Functionality Test Runner
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

echo -e "${BLUE}🎯 Frontend Functionality Test Runner${NC}"
echo "======================================"
echo "Project Root: $PROJECT_ROOT"
echo "Results Dir: $TEST_RESULTS_DIR"
echo ""

echo -e "${BLUE}🌐 Testing frontend functionality...${NC}"
echo "Note: This test focuses on frontend functionality without Demo Data API"
echo ""

# Run the frontend functionality test
TEST_FILE="$SCRIPT_DIR/tests/test-frontend-functionality.mjs"
if [ -f "$TEST_FILE" ]; then
    echo -e "${BLUE}📁 Test file: $TEST_FILE${NC}"

    if node "$TEST_FILE" 2>"$TEST_RESULTS_DIR/frontend-functionality.log"; then
        echo -e "${GREEN}✅ Frontend functionality tests passed!${NC}"
        echo ""
        echo -e "${BLUE}📋 Next Steps:${NC}"
        echo "1. ✅ Frontend is working correctly"
        echo "2. 🔧 Implement Demo Data API in offer service"
        echo "3. 🚀 Deploy Demo Data API to preview environment"
        echo "4. 🧪 Run Demo Data system tests"
        exit 0
    else
        echo -e "${RED}❌ Frontend functionality tests failed!${NC}"
        echo -e "${YELLOW}📄 Check logs: $TEST_RESULTS_DIR/frontend-functionality.log${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Test file not found: $TEST_FILE${NC}"
    exit 1
fi