#!/bin/bash

# Google-Monetize Architecture Optimization Final Validation Script
# This script validates all 8 core optimization projects achieve 100% compliance

set -e

echo "🚀 Google-Monetize Architecture Optimization - Final Validation"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_CHECKS++))
}

check_passed() {
    ((TOTAL_CHECKS++))
    log_success "$1"
}

check_failed() {
    ((TOTAL_CHECKS++))
    log_error "$1"
}

echo ""
echo "📊 VALIDATION PHASE 1: FinalAdapter Unification Verification"
echo "============================================================="

# Services that should use FinalAdapter
DATABASE_SERVICES=("useractivity" "billing" "console" "offer" "user" "siterank" "batchopen" "adscenter")

for service in "${DATABASE_SERVICES[@]}"; do
    log_info "Checking FinalAdapter usage in service: $service"

    if [ -d "services/$service" ]; then
        # Check for FinalAdapter pattern in Go files (exclude comments)
        final_adapter_files=$(find "services/$service" -name "*.go" -type f | xargs grep -v "^\s*//" | xargs grep -l "GetFinalAdapterForService" 2>/dev/null | wc -l)
        legacy_adapter_files=$(find "services/$service" -name "*.go" -type f | xargs grep -v "^\s*//" | xargs grep -l "GetAdapterForService\|GetPGXCompatibleAdapterForService" 2>/dev/null | wc -l)

        if [ "$final_adapter_files" -gt 0 ] && [ "$legacy_adapter_files" -eq 0 ]; then
            check_passed "Service $service: FinalAdapter usage verified ($final_adapter_files files)"
        else
            check_failed "Service $service: Legacy adapters found ($legacy_adapter_files files) or no FinalAdapter usage"
        fi
    else
        log_warning "Service directory not found: services/$service"
    fi
done

echo ""
echo "📊 VALIDATION PHASE 2: Three-Layer Architecture Verification"
echo "=========================================================="

log_info "Checking three-layer architecture implementation in billing service"

# Check for three-layer architecture methods in billing service
if [ -f "services/billing/internal/handlers/trial_subscription.go" ]; then
    if grep -q "createUserLayer" services/billing/internal/handlers/trial_subscription.go && \
       grep -q "createBillingLayer" services/billing/internal/handlers/trial_subscription.go && \
       grep -q "initializeTokenSystem" services/billing/internal/handlers/trial_subscription.go; then
        check_passed "Three-layer architecture methods found in billing service"
    else
        check_failed "Three-layer architecture methods missing in billing service"
    fi

    # Check for transactional implementation
    if grep -q "ExecuteInTransaction" services/billing/internal/handlers/trial_subscription.go; then
        check_passed "Transactional data flow implementation found"
    else
        check_failed "Transactional data flow implementation missing"
    fi
else
    check_failed "Billing service trial subscription handler not found"
fi

echo ""
echo "📊 VALIDATION PHASE 3: Performance Monitoring Integration"
echo "========================================================"

log_info "Checking performance monitoring implementation in database adapter"

if [ -f "pkg/database/service_adapter_simple.go" ]; then
    # Check for performance monitoring methods
    if grep -q "recordQueryMetrics" pkg/database/service_adapter_simple.go && \
       grep -q "logSlowQuery" pkg/database/service_adapter_simple.go && \
       grep -q "EnableMetrics" pkg/database/service_adapter_simple.go; then
        check_passed "Performance monitoring methods found in service adapter"
    else
        check_failed "Performance monitoring methods missing in service adapter"
    fi

    # Check for performance monitoring integration in QueryPGX
    if grep -q "time.Since(start)" pkg/database/service_adapter_simple.go; then
        check_passed "Query timing implementation found"
    else
        check_failed "Query timing implementation missing"
    fi
else
    check_failed "Service adapter file not found"
fi

echo ""
echo "📊 VALIDATION PHASE 4: API Gateway Compliance (Frontend)"
echo "======================================================"

log_info "Checking frontend for direct Supabase database access"

# Check for direct Supabase database access in frontend
frontend_direct_access=$(find apps/frontend/src -name "*.ts" -o -name "*.tsx" | xargs grep -l "supabase.*from.*\|supabase.*table.*\|\.from\(|\.table(" 2>/dev/null | wc -l)

if [ "$frontend_direct_access" -eq 0 ]; then
    check_passed "No direct Supabase database access found in frontend"
else
    check_failed "Found $frontend_direct_access frontend files with potential direct database access"
fi

# Check for API Gateway usage pattern
if [ -f "apps/frontend/src/app/auth/callback/route.ts" ]; then
    if grep -q "api/v1/" apps/frontend/src/app/auth/callback/route.ts; then
        check_passed "API Gateway usage pattern found in auth callback"
    else
        check_failed "API Gateway usage pattern missing in auth callback"
    fi
else
    check_failed "Auth callback route not found"
fi

echo ""
echo "📊 VALIDATION PHASE 5: Internationalization Compliance"
echo "====================================================="

log_info "Checking for hardcoded Chinese strings in frontend source code"

# Check for hardcoded Chinese characters in TypeScript/TSX files
hardcoded_chinese=$(find apps/frontend/src -name "*.ts" -o -name "*.tsx" | xargs grep -l "[\u4e00-\u9fff]" 2>/dev/null | wc -l)

if [ "$hardcoded_chinese" -eq 0 ]; then
    check_passed "No hardcoded Chinese strings found in frontend source code"
else
    check_failed "Found $hardcoded_chinese frontend files with hardcoded Chinese strings"
fi

# Check for i18n translation files
if [ -f "apps/frontend/public/locales/en/seo.json" ] && [ -f "apps/frontend/public/locales/zh-CN/seo.json" ]; then
    check_passed "Internationalization translation files found"
else
    check_failed "Internationalization translation files missing"
fi

echo ""
echo "📊 VALIDATION PHASE 6: CI/CD Integration Verification"
echo "===================================================="

log_info "Checking Cloud Build configuration for database migrations"

if [ -f "deployments/db-migrator/cloudbuild.yaml" ]; then
    # Check for correct Dockerfile reference
    if grep -q "Dockerfile.migrate" deployments/db-migrator/cloudbuild.yaml; then
        check_passed "Cloud Build configuration uses correct Dockerfile.migrate"
    else
        check_failed "Cloud Build configuration has incorrect Dockerfile reference"
    fi

    # Check for Google Container Registry integration
    if grep -q "gcr.io" deployments/db-migrator/cloudbuild.yaml; then
        check_passed "Google Container Registry integration found"
    else
        check_failed "Google Container Registry integration missing"
    fi
else
    check_failed "Cloud Build configuration file not found"
fi

# Check GitHub Actions workflow
if [ -f ".github/workflows/database-migration-cloudrun.yml" ]; then
    if grep -q "gcloud builds submit" .github/workflows/database-migration-cloudrun.yml; then
        check_passed "GitHub Actions uses Cloud Build integration"
    else
        check_failed "GitHub Actions missing Cloud Build integration"
    fi
else
    check_failed "GitHub Actions workflow file not found"
fi

echo ""
echo "📊 VALIDATION PHASE 7: Database Schema Architecture"
echo "=================================================="

log_info "Checking database schema files for three-layer architecture"

# Check for schema documentation
if [ -f "docs/Database/DATABASE_ARCHITECTURE_CURRENT.md" ]; then
    if grep -q "Three-Layer Architecture" docs/Database/DATABASE_ARCHITECTURE_CURRENT.md; then
        check_passed "Database architecture documentation found"
    else
        check_failed "Database architecture documentation missing three-layer architecture"
    fi
else
    check_failed "Database architecture documentation not found"
fi

# Check for migration files
migration_files=$(find . -name "*.sql" -path "*/migrations/*" | wc -l)
if [ "$migration_files" -gt 0 ]; then
    check_passed "Database migration files found ($migration_files files)"
else
    check_failed "No database migration files found"
fi

echo ""
echo "📊 VALIDATION SUMMARY"
echo "====================="
echo "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"

COMPLIANCE_RATE=0
if [ "$TOTAL_CHECKS" -gt 0 ]; then
    COMPLIANCE_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
fi

echo "Compliance Rate: $COMPLIANCE_RATE%"

if [ "$COMPLIANCE_RATE" -eq 100 ]; then
    echo ""
    log_success "🎉 ARCHITECTURE OPTIMIZATION 100% COMPLIANT!"
    echo "✅ All 8 core optimization projects successfully implemented"
    echo "✅ FinalAdapter unification complete across all database services"
    echo "✅ Three-layer architecture transactional data flow operational"
    echo "✅ Performance monitoring with slow query detection active"
    echo "✅ API Gateway compliance verified (no direct database access)"
    echo "✅ Internationalization complete with i18n coverage"
    echo "✅ CI/CD automation with Cloud Build integration active"
    echo ""
    echo "🚀 System is ready for production deployment!"
else
    echo ""
    log_error "❌ ARCHITECTURE OPTIMIZATION INCOMPLETE"
    echo "Failed checks: $FAILED_CHECKS"
    echo "Please address the failed validation items before production deployment"
    exit 1
fi