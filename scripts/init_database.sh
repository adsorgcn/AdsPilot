#!/bin/bash
# ========================================
# Google-Monetize 数据库一键初始化脚本
# 用途: 在空数据库中构建干净的三层架构
# 版本: v2.0
# 创建时间: 2025-10-22
# ========================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 数据库连接配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-gm}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 执行SQL文件
run_sql_file() {
    local sql_file="$1"
    local description="$2"

    log_info "正在执行: $description"
    log_info "文件: $sql_file"

    if [ ! -f "$sql_file" ]; then
        log_error "文件不存在: $sql_file"
        return 1
    fi

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file" 2>&1 | tee /tmp/migration.log; then
        log_success "$description - 完成"
        return 0
    else
        log_error "$description - 失败"
        cat /tmp/migration.log
        return 1
    fi
}

# 执行迁移
run_migration() {
    local service="$1"
    local migration_file="$2"
    local description="$3"

    local sql_file="$PROJECT_ROOT/services/$service/migrations/$migration_file"
    run_sql_file "$sql_file" "$description ($service/$migration_file)"
}

# 检查数据库连接
check_database_connection() {
    log_info "检查数据库连接..."

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        log_success "数据库连接成功"
        return 0
    else
        log_error "数据库连接失败"
        log_error "请检查数据库配置: DB_HOST=$DB_HOST DB_PORT=$DB_PORT DB_NAME=$DB_NAME DB_USER=$DB_USER"
        return 1
    fi
}

# 检查数据库是否为空
check_database_empty() {
    log_info "检查数据库状态..."

    local schema_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('user', 'billing', 'activity', 'offer', 'adscenter', 'console', 'siterank', 'batchopen')" 2>/dev/null | xargs)

    if [ "$schema_count" -eq 0 ]; then
        log_success "数据库为空，可以安全初始化"
        return 0
    else
        log_warning "数据库已存在 $schema_count 个业务Schema"
        read -p "是否继续初始化？这可能会导致数据冲突 (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            log_info "用户取消操作"
            exit 0
        fi
    fi
}

# 验证迁移结果
verify_migrations() {
    log_info "验证迁移结果..."

    local verification_sql="
SELECT
    schema_name,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = schema_name) as table_count,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = schema_name) as view_count
FROM (VALUES
    ('user'),
    ('billing'),
    ('activity'),
    ('offer'),
    ('adscenter'),
    ('console'),
    ('siterank'),
    ('batchopen')
) AS schemas(schema_name)
ORDER BY
    CASE schema_name
        WHEN 'user' THEN 1
        WHEN 'billing' THEN 2
        WHEN 'activity' THEN 3
        ELSE 4
    END;
"

    log_info "Schema统计:"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$verification_sql"

    # 验证Layer 2核心表
    local user_table_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'user' AND table_name = 'users')" 2>/dev/null | xargs)

    if [ "$user_table_exists" = "t" ]; then
        log_success "Layer 2核心表 user.users 已创建"
    else
        log_error "Layer 2核心表 user.users 未创建"
        return 1
    fi

    log_success "所有迁移验证通过"
}

# 主函数
main() {
    echo ""
    echo "========================================"
    echo "🚀 Google-Monetize 数据库初始化脚本"
    echo "========================================"
    echo ""

    # 检查数据库连接
    check_database_connection || exit 1

    # 检查数据库是否为空
    check_database_empty

    echo ""
    log_info "开始数据库初始化..."
    echo ""

    # ========================================
    # Phase 1: Layer 2 - 业务用户层 (最高优先级)
    # ========================================
    echo ""
    log_info "========================================="
    log_info "Phase 1: Layer 2 - 业务用户层"
    log_info "========================================="
    echo ""

    run_migration "user" "000001_create_user_domain_schema.up.sql" "user服务 (Layer 2核心)" || exit 1

    # ========================================
    # Phase 2: Layer 3 Core - 核心业务层
    # ========================================
    echo ""
    log_info "========================================="
    log_info "Phase 2: Layer 3 Core - 核心业务层"
    log_info "========================================="
    echo ""

    run_migration "billing" "001_create_billing_schema.up.sql" "billing服务 (计费层)" || exit 1
    run_migration "useractivity" "001_create_useractivity_schema.up.sql" "useractivity服务 (用户活动)" || exit 1
    run_migration "useractivity" "002_create_notification_management.up.sql" "通知管理系统" || exit 1

    # ========================================
    # Phase 3: Layer 3 Business - 业务域层
    # ========================================
    echo ""
    log_info "========================================="
    log_info "Phase 3: Layer 3 Business - 业务域层"
    log_info "========================================="
    echo ""

    # 这些服务可以并行执行，但为了脚本简单，我们按顺序执行
    run_migration "offer" "001_create_offer_schema.up.sql" "offer服务 (优惠管理)" || exit 1
    run_migration "adscenter" "001_create_adscenter_schema.up.sql" "adscenter服务 (广告中心)" || exit 1
    run_migration "console" "001_create_console_schema.up.sql" "console服务 (管理后台)" || exit 1
    run_migration "siterank" "000001_create_siterank_schema.up.sql" "siterank服务 (站点排名)" || exit 1
    run_migration "batchopen" "000001_create_batchopen_schema.up.sql" "batchopen服务 (批量开通)" || exit 1

    # ========================================
    # 验证迁移结果
    # ========================================
    echo ""
    log_info "========================================="
    log_info "验证迁移结果"
    log_info "========================================="
    echo ""

    verify_migrations || exit 1

    # ========================================
    # 完成
    # ========================================
    echo ""
    echo "========================================"
    log_success "🎉 数据库初始化完成!"
    echo "========================================"
    echo ""

    log_info "三层架构已成功创建:"
    log_info "  Layer 1: Supabase auth.users (认证层)"
    log_info "  Layer 2: Cloud SQL user.users (业务用户层)"
    log_info "  Layer 3: Cloud SQL 8个业务域 (业务数据层)"
    echo ""

    log_info "下一步操作:"
    log_info "  1. 验证数据库结构: psql -d $DB_NAME -f scripts/verify_database.sql"
    log_info "  2. 启动应用服务: make run"
    log_info "  3. 执行端到端测试: make test-e2e"
    echo ""
}

# 执行主函数
main "$@"
