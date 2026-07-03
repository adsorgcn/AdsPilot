#!/bin/bash
# 数据库重���脚本
# 使用psql执行reset-database.sql

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
RESET_SQL="/reset-database.sql"

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

# 检查必需文件
if [[ ! -f "$RESET_SQL" ]]; then
    log_error "重置SQL文件不存在: $RESET_SQL"
    exit 1
fi

if [[ -z "$DATABASE_URL" ]]; then
    log_error "DATABASE_URL环境变量未设置"
    exit 1
fi

# 执行数据库重置
log_info "开始执行数据库重置..."
log_warning "⚠️  此操作将删除所有业务数据！"

# 使用psql执行重置SQL
if psql "$DATABASE_URL" -f "$RESET_SQL"; then
    log_success "数据库重置完成"
else
    log_error "数据库重置失败"
    exit 1
fi