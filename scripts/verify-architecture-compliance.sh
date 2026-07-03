#!/bin/bash

# ===================================================================
# Google-Monetize Architecture Compliance Integration Test Suite
# ===================================================================
# 验证架构优化实施的完整性和��规性
#
# 测试范围：
# 1. FinalAdapter统一化验证 (12个服务)
# 2. 三层架构数据流完整性测试
# 3. 前端架构合规性检查 (无直接Supabase访问)
# 4. 国际化完整性验证 (无硬编码字符串)
# 5. 性能监控功能验证
# 6. CI/CD自动化验证
#
# 使用方法: ./scripts/verify-architecture-compliance.sh [--verbose] [--fix]
# ===================================================================

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# 脚本配置
VERBOSE=${1:-false}
FIX_MODE=${2:-false}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 工具函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_test() {
    echo -e "\n${BLUE}=== Test $((++TOTAL_TESTS)): $1 ===${NC}"
}

# 检查文件是否存在
check_file_exists() {
    local file="$1"
    local description="$2"

    log_test "检查文件存在: $description"

    if [[ -f "$file" ]]; then
        log_success "文件存在: $file"
        return 0
    else
        log_error "文件不存在: $file"
        return 1
    fi
}

# ===================================================================
# 1. FinalAdapter统一化验证 (12个服务)
# ===================================================================
test_final_adapter_unification() {
    log_info "开始 FinalAdapter 统一化验证..."

    local services=(
        "useractivity"
        "billing"
        "console"
        "adscenter"
        "offerdb"
        "notification"
        "analytics"
        "cron"
        "admin"
        "publicapi"
        "gqlgateway"
        "worker"
    )

    local failed_services=()

    for service in "${services[@]}"; do
        log_test "验证服务 $service 使用 FinalAdapter"

        local service_path="services/$service"
        if [[ ! -d "$service_path" ]]; then
            log_warning "服务目录不存在: $service_path"
            continue
        fi

        # 搜索所有Go文件中的adapter使用情况
        local adapter_files=$(find "$service_path" -name "*.go" -type f 2>/dev/null || true)

        if [[ -z "$adapter_files" ]]; then
            log_warning "服务 $service 没有找到Go文件"
            continue
        fi

        local non_final_usage=false

        while IFS= read -r file; do
            # 检查是否使用旧的adapter方法
            if grep -q "database\.GetAdapterForService" "$file" 2>/dev/null; then
                log_error "发现旧adapter使用: $file 使用 GetAdapterForService"
                non_final_usage=true
            fi

            if grep -q "database\.GetPGXCompatibleAdapterForService" "$file" 2>/dev/null; then
                log_error "发现旧adapter使用: $file 使用 GetPGXCompatibleAdapterForService"
                non_final_usage=true
            fi

            # 检查是否使用FinalAdapter
            if grep -q "database\.GetFinalAdapterForService" "$file" 2>/dev/null; then
                if [[ "$VERBOSE" == "true" ]]; then
                    log_success "正确使用FinalAdapter: $file"
                fi
            fi
        done <<< "$adapter_files"

        if [[ "$non_final_usage" == "false" ]]; then
            log_success "服务 $service 完全使用FinalAdapter"
        else
            failed_services+=("$service")
        fi
    done

    if [[ ${#failed_services[@]} -eq 0 ]]; then
        log_success "所有服务都已完成FinalAdapter统一化"
    else
        log_error "以下服务未完成FinalAdapter统一化: ${failed_services[*]}"
        return 1
    fi
}

# ===================================================================
# 2. 三层架构数据流完整性测试
# ===================================================================
test_three_layer_architecture() {
    log_info "开始三层架构数据流完整性测试..."

    log_test "检查billing服务三层架构实现"

    local billing_handler="services/billing/internal/handlers/trial_subscription.go"

    if check_file_exists "$billing_handler" "Trial Subscription Handler"; then
        # 检查三层数据创建方法是否存在
        local required_methods=(
            "createUserLayer"
            "createBillingLayer"
            "initializeTokenSystem"
        )

        local missing_methods=()

        for method in "${required_methods[@]}"; do
            if grep -q "func.*$method" "$billing_handler" 2>/dev/null; then
                log_success "方法存在: $method"
            else
                log_error "方法缺失: $method"
                missing_methods+=("$method")
            fi
        done

        # 检查事务性实现
        if grep -q "tx.*BeginTx\|database\.BeginTx" "$billing_handler" 2>/dev/null; then
            log_success "事务性实现存在"
        else
            log_warning "未找到事务性实现"
        fi

        # 检查三层调用顺序
        if grep -q "createUserLayer.*createBillingLayer.*initializeTokenSystem" "$billing_handler" 2>/dev/null; then
            log_success "三层调用顺序正确"
        else
            log_warning "三层调用顺序可能不完整"
        fi

        if [[ ${#missing_methods[@]} -eq 0 ]]; then
            log_success "三层架构数据流完整性验证通过"
        else
            log_error "缺失方法: ${missing_methods[*]}"
            return 1
        fi
    fi
}

# ===================================================================
# 3. 前端架构合规性检查 (无直接Supabase访问)
# ===================================================================
test_frontend_architecture_compliance() {
    log_info "开始前端架构合规性检查..."

    log_test "检查前端认证回调路由"

    local auth_callback="apps/frontend/src/app/auth/callback/route.ts"

    if check_file_exists "$auth_callback" "Auth Callback Route"; then
        # 检查是否没有直接Supabase数据库访问
        local supabase_client_patterns=(
            "supabase\.from\("
            "supabase\.rpc\("
            "\.supabase\."
            "createClient\(\).*supabase"
        )

        local violations=()

        for pattern in "${supabase_client_patterns[@]}"; do
            if grep -qE "$pattern" "$auth_callback" 2>/dev/null; then
                violations+=("$pattern")
            fi
        done

        # 检查是否使用API Gateway
        if grep -q "fetch.*/api/" "$auth_callback" 2>/dev/null; then
            log_success "使用API Gateway进行后端通信"
        else
            log_warning "未发现API Gateway使用模式"
        fi

        if [[ ${#violations[@]} -eq 0 ]]; then
            log_success "前端架构合规性验证通过 (无直接Supabase访问)"
        else
            log_error "发现直接Supabase访问模式: ${violations[*]}"
            return 1
        fi
    fi
}

# ===================================================================
# 4. 国际化完整性验证 (无硬编码字符串)
# ===================================================================
test_i18n_completeness() {
    log_info "开始国际化完整性验证..."

    log_test "检查前端文件中的硬编码字符串"

    local frontend_src="apps/frontend/src"
    local hardcoded_patterns=(
        # 中文硬编码
        "[\u4e00-\u9fff]+"
        # 英文硬编码 (需要更智能的检测)
        "title[\"']:[\"'][^\"']*[\"']"
        "description[\"']:[\"'][^\"']*[\"']"
    )

    local violation_files=()

    # 检查TypeScript/JavaScript文件
    while IFS= read -r file; do
        local file_violations=false

        # 检查中文字符
        if grep -qP "[\u4e00-\u9fff]" "$file" 2>/dev/null; then
            # 排除注释和翻译文件
            if ! grep -q "//.*[\u4e00-\u9fff]" "$file" 2>/dev/null &&
               [[ "$file" != *"/locales/"* ]]; then
                log_warning "发现中文字符: $file"
                file_violations=true
            fi
        fi

        # 检查硬编码的title和description
        if grep -qE "title[\"']:[\"'][^\"']*[\"']" "$file" 2>/dev/null; then
            # 检查是否使用了t()函数
            if ! grep -q "t(" "$file" 2>/dev/null; then
                log_warning "可能存在硬编码title: $file"
                file_violations=true
            fi
        fi

        if [[ "$file_violations" == "true" ]]; then
            violation_files+=("$file")
        fi

    done < <(find "$frontend_src" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null)

    # 检查翻译文件完整性
    log_test "检查翻译文件完整性"

    local locales=(
        "apps/frontend/public/locales/en"
        "apps/frontend/public/locales/zh-CN"
    )

    local required_translation_files=(
        "seo.json"
        "common.json"
    )

    for locale in "${locales[@]}"; do
        for trans_file in "${required_translation_files[@]}"; do
            local file_path="$locale/$trans_file"
            if [[ -f "$file_path" ]]; then
                log_success "翻译文件存在: $file_path"
            else
                log_warning "翻译文件缺失: $file_path"
            fi
        done
    done

    if [[ ${#violation_files[@]} -eq 0 ]]; then
        log_success "国际化完整性验证通过"
    else
        log_warning "发现潜在硬编码问题: ${#violation_files[@]} 个文件"
        if [[ "$VERBOSE" == "true" ]]; then
            printf '%s\n' "${violation_files[@]}"
        fi
    fi
}

# ===================================================================
# 5. 性能监控功能验证
# ===================================================================
test_performance_monitoring() {
    log_info "开始性能监控功能验证..."

    log_test "检查数据库适配器性能监控实现"

    local adapter_file="pkg/database/service_adapter_simple.go"

    if check_file_exists "$adapter_file" "Service Adapter"; then
        # 检查性能监控相关方法
        local monitoring_methods=(
            "recordQueryMetrics"
            "logSlowQuery"
            "classifyQuery"
            "hashQuery"
        )

        local missing_methods=()

        for method in "${monitoring_methods[@]}"; do
            if grep -q "func.*$method" "$adapter_file" 2>/dev/null; then
                log_success "监控方法存在: $method"
            else
                log_error "监控方法缺失: $method"
                missing_methods+=("$method")
            fi
        done

        # 检查Query方法中的监控实现
        if grep -q "time\.Now()" "$adapter_file" 2>/dev/null &&
           grep -q "recordQueryMetrics" "$adapter_file" 2>/dev/null; then
            log_success "Query方法包含性能监控"
        else
            log_warning "Query方法性能监控可能不完整"
        fi

        # 检查配置选项
        if grep -q "EnableMetrics" "$adapter_file" 2>/dev/null; then
            log_success "性能监控配置选项存在"
        else
            log_warning "未找到性能监控配置选项"
        fi

        if [[ ${#missing_methods[@]} -eq 0 ]]; then
            log_success "性能监控功能验证通过"
        else
            log_error "缺失监控方法: ${missing_methods[*]}"
            return 1
        fi
    fi
}

# ===================================================================
# 6. CI/CD自动化验证
# ===================================================================
test_cicd_automation() {
    log_info "开始CI/CD自动化验证..."

    log_test "检查Cloud Build配置"

    local cloudbuild_file="deployments/db-migrator/cloudbuild.yaml"

    if check_file_exists "$cloudbuild_file" "Cloud Build Config"; then
        # 检查Dockerfile路径是否正确
        if grep -q "Dockerfile.migrate" "$cloudbuild_file" 2>/dev/null; then
            log_success "Dockerfile路径正确"
        else
            log_error "Dockerfile路径可能不正确"
        fi

        # 检查构建配置
        if grep -q "gcr.io" "$cloudbuild_file" 2>/dev/null; then
            log_success "Google Container Registry配置存在"
        fi
    fi

    log_test "检查GitHub Actions工作流"

    local workflow_file=".github/workflows/database-migration-cloudrun.yml"

    if check_file_exists "$workflow_file" "GitHub Actions Workflow"; then
        # 检查是否使用Cloud Build而不是Docker
        if grep -q "gcloud builds submit" "$workflow_file" 2>/dev/null; then
            log_success "使用Cloud Build进行镜像构建"
        else
            log_warning "可能仍在使用Docker构建"
        fi

        # 检查部署配置
        if grep -q "gcloud run deploy" "$workflow_file" 2>/dev/null; then
            log_success "Cloud Run部署配置存在"
        fi
    fi
}

# ===================================================================
# 主测试执行函数
# ===================================================================
main() {
    log_info "Google-Monetize 架构合规性集成测试开始..."
    log_info "项目根目录: $PROJECT_ROOT"

    # 切换到项目根目录
    cd "$PROJECT_ROOT"

    # 执行所有测试
    test_final_adapter_unification || true
    test_three_layer_architecture || true
    test_frontend_architecture_compliance || true
    test_i18n_completeness || true
    test_performance_monitoring || true
    test_cicd_automation || true

    # 输出测试结果摘要
    echo -e "\n${BLUE}=== 架构合规性测试结果摘要 ===${NC}"
    echo -e "总测试数: $TOTAL_TESTS"
    echo -e "${GREEN}通过测试: $PASSED_TESTS${NC}"
    echo -e "${YELLOW}警告数量: $WARNINGS${NC}"
    echo -e "${RED}失败测试: $FAILED_TESTS${NC}"

    # 计算成功率
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi

    echo -e "成功率: $success_rate%"

    # 输出架构状态评估
    echo -e "\n${BLUE}=== 架构状态评估 ===${NC}"

    if [[ $success_rate -ge 90 ]]; then
        echo -e "${GREEN}✅ 架构优化状态: 优秀 (≥90%)${NC}"
        echo -e "${GREEN}   系统已达到生产就绪状态${NC}"
    elif [[ $success_rate -ge 75 ]]; then
        echo -e "${YELLOW}⚠️  架构优化状态: 良好 (75-89%)${NC}"
        echo -e "${YELLOW}   存在少量问题需要修复${NC}"
    else
        echo -e "${RED}❌ 架构优化状态: 需要改进 (<75%)${NC}"
        echo -e "${RED}   存在重大架构问题需要立即处理${NC}"
    fi

    # 输出建议
    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo -e "\n${YELLOW}=== 修复建议 ===${NC}"
        echo -e "1. 优先修复失败的测试项目"
        echo -e "2. 运行 $0 --fix 自动修复部分问题"
        echo -e "3. 手动检查标记的文件和配置"
        echo -e "4. 重新运行测试验证修复效果"
    fi

    # 返回适当的退出码
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "所有架构合规性测试通过!"
        return 0
    else
        log_error "发现 $FAILED_TESTS 个架构合规性问题"
        return 1
    fi
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi