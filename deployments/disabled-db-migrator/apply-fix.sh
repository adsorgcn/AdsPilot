#!/bin/bash
# 独立修复脚本 - 直接应用 user schema 修复

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

log_info "开始应用 User Schema 修复..."

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

# 应用修复脚本
log_info "应用 User Schema 修复..."
if psql "$DATABASE_URL" -f /fix-user-schema.sql; then
    log_success "User Schema 修复完成"
else
    log_error "User Schema 修复失败"
    exit 1
fi

log_success "🎉 所有修复操作完成！"