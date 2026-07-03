#!/bin/bash
# 带清理功能的迁移脚本

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[信息]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[成功]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[错误]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[警告]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 配置
DATABASE_URL="${DATABASE_URL:-}"
SERVICE_NAME="${SERVICE_NAME:-all}"
MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT:-10m}"

# 检查数据库连接
if [[ -z "$DATABASE_URL" ]]; then
    log_error "DATABASE_URL 环境变量未设置"
    exit 1
fi

# 测试数据库连接
log_info "测试数据库连接..."
if ! pg_isready -d "$DATABASE_URL" -t 30; then
    log_error "数据库连接失败"
    exit 1
fi

# 清理损坏的迁移状态
log_info "清理损坏的迁移状态..."
psql "$DATABASE_URL" -c "DELETE FROM public.schema_migrations WHERE version=1 AND dirty=true;" || true
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS \"user\" CASCADE;" || true
log_success "数据库清理完成"

# 迁移函数
run_migration() {
    local service="$1"
    local migration_path="/migrations/$service"

    if [[ ! -d "$migration_path" ]]; then
        log_warning "服务 $service 的迁移目录不存在: $migration_path"
        return 0
    fi

    log_info "开始执行服务 $service 的数据库迁移..."

    # 使用golang-migrate执行迁移
    if migrate -path "$migration_path" -database "$DATABASE_URL" up; then
        log_success "服务 $service 的数据库迁移完成"
    else
        log_error "服务 $service 的数据库迁移失败"
        return 1
    fi
}

# 主逻辑
log_info "开始数据库迁移流程..."
log_info "目标服务: $SERVICE_NAME"

case "$SERVICE_NAME" in
    "user")
        run_migration "$SERVICE_NAME"
        ;;
    *)
        log_error "此脚本仅支持 user 服务迁移"
        exit 1
        ;;
esac

log_success "数据库迁移完成！"