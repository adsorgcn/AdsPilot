#!/bin/bash

# Preview Environment Test Runner
# This script runs E2E tests against www.urlchecker.dev

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PREVIEW_BASE="https://www.urlchecker.dev"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"

# Ensure test results directory exists
mkdir -p "$TEST_RESULTS_DIR"

echo -e "${BLUE}🌐 Preview Environment E2E Test Runner${NC}"
echo "===================================="
echo "Environment: $PREVIEW_BASE"
echo "Project Root: $PROJECT_ROOT"
echo "Results Dir: $TEST_RESULTS_DIR"
echo ""

# Parse command line arguments
SUITE_TYPE="critical"
HEADLESS=true
PARALLEL=false
RETRIES=1
TIMEOUT=180000

while [[ $# -gt 0 ]]; do
    case $1 in
        --suite|-s)
            SUITE_TYPE="$2"
            shift 2
            ;;
        --headless)
            HEADLESS=true
            shift
            ;;
        --headed)
            HEADLESS=false
            shift
            ;;
        --parallel|-p)
            PARALLEL=true
            shift
            ;;
        --retries|-r)
            RETRIES="$2"
            shift 2
            ;;
        --timeout|-t)
            TIMEOUT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --suite, -s TYPE    Test suite type (critical, subscription, business, performance, all)"
            echo "  --headless          Run tests in headless mode (default)"
            echo "  --headed            Run tests with browser UI"
            echo "  --parallel, -p       Run tests in parallel (experimental)"
            echo "  --retries, -r NUM    Number of retries (default: 1)"
            echo "  --timeout, -t MS     Test timeout in milliseconds (default: 180000)"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Test Suites:"
            echo "  critical      - Core functionality tests (default)"
            echo "  subscription  - Subscription system enhancement tests"
            echo "  business       - Business functionality tests"
            echo "  performance   - Performance and load tests"
            echo "  demo-data     - Demo data system tests"
            echo "  all           - Run all test suites"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "Configuration:"
echo "  Suite Type: $SUITE_TYPE"
echo "  Headless Mode: $HEADLESS"
echo "  Parallel Mode: $PARALLEL"
echo "  Retries: $RETRIES"
echo "  Timeout: ${TIMEOUT}ms"
echo ""

# Environment variables for Node.js
export NODE_ENV=test
export PREVIEW_BASE="$PREVIEW_BASE"
export HEADLESS="$HEADLESS"
export TEST_TIMEOUT="$TIMEOUT"

# Function to run a single test
run_test() {
    local test_file="$1"
    local test_name="$2"
    local retry_count=0

    echo -e "${BLUE}🧪 Running: $test_name${NC}"

    while [ $retry_count -lt $RETRIES ]; do
        if [ $retry_count -gt 0 ]; then
            echo -e "${YELLOW}  Retry $((retry_count + 1))/${RETRIES}...${NC}"
        fi

        if node "$test_file" 2>" "$TEST_RESULTS_DIR/${test_name}.log"; then
            echo -e "${GREEN}✅ $test_name passed${NC}"
            return 0
        else
            echo -e "${RED}❌ $test_name failed${NC}"
            retry_count=$((retry_count + 1))
        fi
    done

    echo -e "${RED}❌ $test_name failed after $RETRIES retries${NC}"
    return 1
}

# Function to run test suite
run_suite() {
    local suite_type="$1"
    local test_start_time=$(date +%s)
    local test_results_file="$TEST_RESULTS_DIR/test-results-$(date +%Y%m%d-%H%M%S).json"

    echo -e "${BLUE}🎯 Running $suite_type test suite...${NC}"

    case "$suite_type" in
        "critical")
            echo "Running critical functionality tests..."

            local critical_tests=(
                "test-preview-environment.mjs:Critical Tests"
            )

            local failed_tests=0
            local total_tests=${#critical_tests[@]}

            for test_pair in "${critical_tests[@]}"; do
                IFS=':' read -r test_file test_name <<< "$test_pair"

                if ! run_test "$test_file" "$test_name"; then
                    failed_tests=$((failed_tests + 1))
                fi

                # Small delay between tests
                sleep 2
            done

            ;;

        "subscription")
            echo "Running subscription system enhancement tests..."

            local subscription_tests=(
                "test-trial-subscription-system.mjs:Trial Subscription System"
                "test-billing-permission-service.mjs:Billing Permission Service"
                "test-token-cost-service.mjs:Token Cost Service"
                "test-gateway-middleware-permissions.mjs:Gateway Middleware Permissions"
                "test-token-reservation-mechanism.mjs:Token Reservation Mechanism"
                "test-subscription-config-hotreload.mjs:Subscription Config Hot Reload"
                "test-trial-subscription-migration.mjs:Trial Subscription Migration"
            )

            local failed_tests=0
            local total_tests=${#subscription_tests[@]}

            for test_pair in "${subscription_tests[@]}"; do
                IFS=':' read -r test_file test_name <<< "$test_pair"

                if ! run_test "$test_file" "$test_name"; then
                    failed_tests=$((failed_tests + 1))
                fi

                sleep 2
            done

            ;;

        "business")
            echo "Running business functionality tests..."

            local business_tests=(
                "test-offer-evaluation-complete.mjs:Offer Evaluation Complete"
                "test-ai-evaluation-complete.mjs:AI Evaluation Complete"
                "test-user-permissions-complete.mjs:User Permissions Complete"
                "test-settings-complete.mjs:Settings Complete"
                "test-manage-complete.mjs:Manage Complete"
            )

            local failed_tests=0
            local total_tests=${#business_tests[@]}

            for test_pair in "${business_tests[@]}"; do
                IFS=':' read -r test_file test_name <<< "$test_pair"

                if ! run_test "$test_file" "$test_name"; then
                    failed_tests=$((failed_tests + 1))
                fi

                sleep 2
            done

            ;;

        "performance")
            echo "Running performance and load tests..."

            local performance_tests=(
                "test-performance-baseline.mjs:Performance Baseline"
                "test-load-testing.mjs:Load Testing"
            )

            local failed_tests=0
            local total_tests=${#performance_tests[@]}

            for test_pair in "${performance_tests[@]}"; do
                IFS=':' read -r test_file test_name <<< "$test_pair"

                if ! run_test "$test_file" "$test_name"; then
                    failed_tests=$((failed_tests + 1))
                fi

                sleep 5
            done

            ;;

        "demo-data")
            echo "Running demo data system tests..."

            local demo_data_tests=(
                "test-demo-data-system.mjs:Demo Data System Tests"
            )

            local failed_tests=0
            local total_tests=${#demo_data_tests[@]}

            for test_pair in "${demo_data_tests[@]}"; do
                IFS=':' read -r test_file test_name <<< "$test_pair"

                if ! run_test "$test_file" "$test_name"; then
                    failed_tests=$((failed_tests + 1))
                fi

                sleep 2
            done

            ;;

        "all")
            echo "Running all test suites..."

            # Run all suites sequentially
            run_suite "critical"
            local critical_result=$?

            run_suite "demo-data"
            local demo_data_result=$?

            run_suite "subscription"
            local subscription_result=$?

            run_suite "business"
            local business_result=$?

            run_suite "performance"
            local performance_result=$?

            # Check if any suite failed
            local overall_result=0
            [ $critical_result -eq 0 ] && [ $demo_data_result -eq 0 ] && \
            [ $subscription_result -eq 0 ] && [ $business_result -eq 0 ] && \
            [ $performance_result -eq 0 ]

            exit $overall_result

            ;;

        *)
            echo -e "${RED}❌ Unknown test suite: $suite_type${NC}"
            echo "Available suites: critical, demo-data, subscription, business, performance, all"
            exit 1
            ;;
    esac

    local test_end_time=$(date +%s)
    local total_duration=$((test_end_time - test_start_time))

    # Generate summary report
    echo -e "\n${BLUE}📊 Test Suite Summary${NC}"
    echo "==================="
    echo "Suite Type: $suite_type"
    echo "Duration: ${total_duration}s"
    echo "Passed Tests: $((total_tests - failed_tests))"
    echo "Failed Tests: $failed_tests"
    echo "Success Rate: $(((total_tests - failed_tests) * 100 / total_tests))%"
    echo ""

    # Save test results to JSON file
    local results_json=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "environment": "preview",
  "baseUrl": "$PREVIEW_BASE",
  "suiteType": "$suite_type",
  "duration": $total_duration,
  "totalTests": $total_tests,
  "passedTests": $((total_tests - failed_tests)),
  "failedTests": $failed_tests,
  "successRate": $(((total_tests - failed_tests) * 100 / total_tests)),
  "retries": $RETRIES,
  "timeout": $TIMEOUT
}
EOF
)

    echo "$results_json" > "$test_results_file"
    echo -e "${GREEN}📄 Test results saved to: $test_results_file${NC}"

    # Exit with appropriate code
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests in $suite_type suite passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ $failed_tests test(s) in $suite_type suite failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🔍 Checking environment prerequisites...${NC}"

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
        exit 1
    fi

    # Check Node.js version
    local node_version=$(node --version)
    echo -e "${GREEN}✅ Node.js version: $node_version${NC}"

    # Check if we can reach the preview environment
    echo -e "${BLUE}🌐 Checking preview environment connectivity...${NC}"
    if curl -s --max-time 10 "$PREVIEW_BASE" > /dev/null; then
        echo -e "${GREEN}✅ Preview environment is accessible${NC}"
    else
        echo -e "${RED}❌ Cannot reach preview environment: $PREVIEW_BASE${NC}"
        echo -e "${YELLOW}⚠️  Make sure the preview environment is deployed and accessible${NC}"
        exit 1
    fi

    # Run the specified test suite
    echo ""
    run_suite "$SUITE_TYPE"
}

# Handle interruption
trap 'echo -e "\n${YELLOW}⚠️  Test execution interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"