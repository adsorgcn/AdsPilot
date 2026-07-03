#!/bin/bash

# adscenter服务数据库迁移脚本
# 专注于核心功能实现

set -euo pipefail

readonly SERVICE="adscenter"
readonly MIGRATION_ID="adscenter_$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="/tmp/adscenter_migration_${MIGRATION_ID}.log"

# 数据库连接配置
readonly DB_HOST="${DB_HOST:-localhost}"
readonly DB_PORT="${DB_PORT:-5432}"
readonly DB_NAME="${DB_NAME:-gm_db}"
readonly DB_USER="${DB_USER:-postgres}"
readonly DB_PASSWORD="${DB_PASSWORD:-password}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE" >&2
}

success() {
    echo "[SUCCESS] $1" | tee -a "$LOG_FILE"
}

# 检查数据库连接
check_db_connection() {
    log "检查数据库连接..."

    if ! command -v psql >/dev/null 2>&1; then
        error "psql命令未找到，请安装PostgreSQL客户端"
        return 1
    fi

    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        error "无法连接到数据库 $DB_NAME"
        error "请检查数据库连接配置"
        return 1
    fi

    success "数据库连接正常"
    return 0
}

# 执行迁移
execute_migration() {
    log "开始执行adscenter迁移..."

    # DDL语句
    local ddl_statements=(
        # UserAdsConnection表
        "CREATE TABLE IF NOT EXISTS \"UserAdsConnection\" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          \"userId\" TEXT NOT NULL,
          \"loginCustomerId\" TEXT NOT NULL,
          \"primaryCustomerId\" TEXT,
          \"refreshToken\" TEXT NOT NULL,
          \"scopes\" TEXT,
          \"createdAt\" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          \"updatedAt\" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )"

        # UserAdsConnection索引
        "CREATE INDEX IF NOT EXISTS idx_useradsconnection_user ON \"UserAdsConnection\"(\"userId\")"

        # BulkActionOperation表
        "CREATE TABLE IF NOT EXISTS \"BulkActionOperation\" (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          plan JSONB,
          status TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )"

        # BulkActionAudit表
        "CREATE TABLE IF NOT EXISTS \"BulkActionAudit\" (
          id BIGSERIAL PRIMARY KEY,
          op_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          snapshot JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"

        # BulkActionAudit索引
        "CREATE INDEX IF NOT EXISTS ix_bulk_audit_op ON \"BulkActionAudit\"(op_id, created_at)"

        # AuditEvent表
        "CREATE TABLE IF NOT EXISTS \"AuditEvent\" (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"

        # AuditEvent索引
        "CREATE INDEX IF NOT EXISTS ix_audit_event_user_kind_time ON \"AuditEvent\"(user_id, kind, created_at DESC)"
    )

    local success_count=0
    local total_count=${#ddl_statements[@]}

    # 执行DDL语句
    for i in "${!ddl_statements[@]}"; do
        local ddl="${ddl_statements[$i]}"

        log "执行DDL $((i+1))/$total_count"

        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$ddl" >> "$LOG_FILE" 2>&1; then
            success "DDL执行成功: $((i+1))/$total_count"
            success_count=$((success_count + 1))
        else
            error "DDL执行失败: $((i+1))/$total_count"
            error "DDL语句: $ddl"
        fi
    done

    log "DDL执行完成: $success_count/$total_count 成功"
    return 0
}

# 验证迁移结果
verify_migration() {
    log "验证迁移结果..."

    local expected_tables=("UserAdsConnection" "BulkActionOperation" "BulkActionAudit" "AuditEvent")
    local expected_indexes=("idx_useradsconnection_user" "ix_bulk_audit_op" "ix_audit_event_user_kind_time")

    # 验证表创建
    local created_tables=0
    for table in "${expected_tables[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt \"$table\"" 2>/dev/null | grep -q "$table"; then
            success "✅ 表 '$table' 创建成功"
            created_tables=$((created_tables + 1))
        else
            error "❌ 表 '$table' 创建失败"
        fi
    done

    # 验证索引创建
    local created_indexes=0
    for index in "${expected_indexes[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\di \"$index\"" 2>/dev/null | grep -q "$index"; then
            success "✅ 索引 '$index' 创建成功"
            created_indexes=$((created_indexes + 1))
        else
            error "❌ 索引 '$index' 创建失败"
        fi
    done

    log "验证结果: 表 $created_tables/${#expected_tables[@]}, 索引 $created_indexes/${#expected_indexes[@]}"

    if [ $created_tables -eq ${#expected_tables[@]} ] && [ $created_indexes -eq ${#expected_indexes[@]} ]; then
        success "迁移验证完全通过！"
        return 0
    else
        error "迁移验证部分失败"
        return 1
    fi
}

# 主执行流程
main() {
    log "========================================="
    log "adscenter服务数据库迁移开始"
    log "迁移ID: $MIGRATION_ID"
    log "========================================="

    if ! check_db_connection; then
        error "数据库连接检查失败，终止迁移"
        exit 1
    fi

    if ! execute_migration; then
        error "迁移执行失败"
        exit 1
    fi

    if ! verify_migration; then
        error "迁移验证失败"
        exit 1
    fi

    success "========================================="
    success "adscenter迁移成功完成！"
    success "迁移ID: $MIGRATION_ID"
    success "执行日志: $LOG_FILE"
    success "========================================="

    # 下一步建议
    echo ""
    echo "建议下一步操作:"
    echo "1. 更新adscenter服务代码使用适配器"
    echo "2. 验证服务功能正常"
    echo "3. 测试数据库操作"
}

# 执行主函数
main "$@"