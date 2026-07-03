#!/bin/bash
# 数据库迁移脚本 - 使用golang-migrate工具
# 支持指定服务迁移或全量迁移

set -euo pipefail

# 配置
DATABASE_URL="${DATABASE_URL:-}"
SERVICE_NAME="${SERVICE_NAME:-all}"
MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT:-10m}"

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

# 检查必需工具
command -v migrate >/dev/null 2>&1 || { log_error "golang-migrate 工具未安装"; exit 1; }

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
log_info "迁移超时: $MIGRATION_TIMEOUT"

case "$SERVICE_NAME" in
    "all")
        log_info "执行全量迁移..."
        services=("user" "billing" "useractivity" "offer" "siterank" "console" "adscenter" "batchopen")
        for service in "${services[@]}"; do
            if ! run_migration "$service"; then
                log_error "全量迁移失败，停止执行"
                exit 1
            fi
        done
        ;;
    "user"|"billing"|"useractivity"|"offer"|"siterank"|"console"|"adscenter"|"batchopen")
        run_migration "$SERVICE_NAME"
        ;;
    *)
        log_error "未知的服务名称: $SERVICE_NAME"
        log_info "支持的服务: user, billing, useractivity, offer, siterank, console, adscenter, batchopen, all"
        exit 1
        ;;
esac

log_success "所有数据库迁移完成！"