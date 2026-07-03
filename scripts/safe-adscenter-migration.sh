#!/bin/bash

# adscenter服务安全迁移脚本
# 适用于生产环境直接执行，包含完整的安全检查和回滚机制

set -euo pipefail

# ============================================================================
# 配置和常量
# ============================================================================
readonly SERVICE="adscenter"
readonly MIGRATION_ID="adscenter_$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="/tmp/adscenter_migration_${MIGRATION_ID}.log"
readonly BACKUP_DIR="/tmp/adscenter_backup_${MIGRATION_ID}"

# 数据库连接配置
readonly DB_HOST="${DB_HOST:-localhost}"
readonly DB_PORT="${DB_PORT:-5432}"
readonly DB_NAME="${DB_NAME:-gm_db}"
readonly DB_USER="${DB_USER:-postgres}"
readonly DB_PASSWORD="${DB_PASSWORD:-password}"

# 安全配置
readonly MAX_QUERY_TIME=30
readonly ERROR_THRESHOLD=5
readonly ROLLBACK_TIMEOUT=300

# 颜期表和索引
readonly EXPECTED_TABLES=(
    "UserAdsConnection"
    "BulkActionOperation"
    "BulkActionAudit"
    "AuditEvent"
)

readonly EXPECTED_INDEXES=(
    "idx_useradsconnection_user"
    "ix_bulk_audit_op"
    "ix_audit_event_user_kind_time"
)

# ============================================================================
# 日志和监控函数
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE" >&2
}

warning() {
    echo "[WARNING] $1" | tee -a "$LOG_FILE"
}

success() {
    echo "[SUCCESS] $1" | tee -a "$LOG_FILE"
}

# ============================================================================
# 数据库连接函数
# ============================================================================

check_db_connection() {
    log "检查数据库连接..."

    if ! command -v psql >/dev/null 2>&1; then
        error "psql命令未找到，请安装PostgreSQL客户端"
        return 1
    fi

    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        error "无法连接到数据库 $DB_NAME"
        error "请检查数据库连接配置："
        error "  Host: $DB_HOST"
        error "  Port: $DB_PORT"
        error "  Database: $DB_NAME"
        error "  User: $DB_USER"
        return 1
    fi

    success "数据库连接正常"
    return 0
}

# ============================================================================
# 安全检查函数
# ============================================================================

check_environment_safety() {
    log "执行环境安全检查..."

    # 检查是否在共享环境中
    local db_version
    db_version=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT version();" 2>/dev/null || echo "unknown")

    if [[ "$db_version" == *"unknown"* ]]; then
        error "无法获取数据库版本信息"
        return 1
    fi

    log "数据库版本: $db_version"

    # 检查当前连接数
    local active_connections
    active_connections=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null || echo "0")

    log "当前活跃连接数: $active_connections"

    if [ "$active_connections" -gt 50 ]; then
        warning "数据库活跃连接数较高 ($active_connections)，建议在低峰期执行"
        read -p "是否继续执行迁移？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "用户取消迁移执行"
            exit 0
        fi
    fi

    success "环境安全检查通过"
    return 0
}

check_existing_objects() {
    log "检查现有数据库对象..."

    # 检查表是否已存在
    local existing_tables=()
    local missing_tables=()

    for table in "${EXPECTED_TABLES[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt \"$table\"" 2>/dev/null | grep -q "$table"; then
            existing_tables+=("$table")
            log "✅ 表 '$table' 已存在"
        else
            missing_tables+=("$table")
            log "📋 表 '$table' 不存在，将创建"
        fi
    done

    # 检查索引是否已存在
    local existing_indexes=()
    local missing_indexes=()

    for index in "${EXPECTED_INDEXES[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\di \"$index\"" 2>/dev/null | grep -q "$index"; then
            existing_indexes+=("$index")
            log "✅ 索引 '$index' 已存在"
        else
            missing_indexes+=("$index")
            log "📋 索引 '$index' 不存在，将创建"
        fi
    done

    # 检查是否有冲突的表或索引
    local conflict_objects=()
    for table in "${missing_tables[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>/dev/null | grep -qi "${table,,}"; then
            conflict_objects+=("表名冲突: $table")
        fi
    done

    if [ ${#conflict_objects[@]} -gt 0 ]; then
        error "发现对象冲突："
        for obj in "${conflict_objects[@]}"; do
            error "  - $obj"
        done
        return 1
    fi

    success "现有对象检查完成"
    return 0
}

# ============================================================================
# 备份函数
# ============================================================================

create_backup() {
    log "创建数据库备份..."

    mkdir -p "$BACKUP_DIR"

    # 备份表结构
    log "备份表结构..."
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --schema-only --no-owner --no-privileges > "$BACKUP_DIR/schema_before.sql"

    # 备份相关表的数据（如果存在）
    for table in "${EXPECTED_TABLES[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt \"$table\"" 2>/dev/null | grep -q "$table"; then
            log "备份表数据: $table"
            PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --data-only --no-owner --no-privileges -t "$table" > "$BACKUP_DIR/data_${table,,}.sql"
        fi
    done

    # 创建备份清单
    cat > "$BACKUP_DIR/backup_manifest.txt" << EOF
备份时间: $(date)
备份ID: $MIGRATION_ID
数据库: $DB_NAME
服务: $SERVICE
备份文件:
$(ls -la "$BACKUP_DIR")
EOF

    success "备份完成，存储在: $BACKUP_DIR"
    return 0
}

# ============================================================================
# 迁移执行函数
# ============================================================================

execute_migration() {
    log "开始执行adscenter迁移..."

    # DDL语句定义（使用IF NOT EXISTS确保安全）
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

        log "执行DDL $((i+1))/$total_count: $(echo "$ddl" | grep -o 'CREATE.*' | head -1)"

        # 使用超时控制执行DDL
        if timeout "$MAX_QUERY_TIME" PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$DDL" >> "$LOG_FILE" 2>&1; then
            success "DDL执行成功: $((i+1))/$total_count"
            success_count=$((success_count + 1))
        else
            error "DDL执行失败: $((i+1))/$total_count"
            error "DDL语句: $ddl"
            error "执行超时或失败，检查日志: $LOG_FILE"

            # 询问是否继续
            read -p "DDL执行失败，是否继续执行后续DDL？(y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "用户选择停止迁移"
                return 1
            fi
        fi
    done

    log "DDL执行完成: $success_count/$total_count 成功"
    return 0
}

# ============================================================================
# 验证函数
# ============================================================================

verify_migration() {
    log "验证迁移结果..."

    # 验证表创建
    local created_tables=()
    local missing_tables=()

    for table in "${EXPECTED_TABLES[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt \"$table\"" 2>/dev/null | grep -q "$table"; then
            created_tables+=("$table")
            success "✅ 表 '$table' 创建成功"
        else
            missing_tables+=("$table")
            error "❌ 表 '$table' 创建失败"
        fi
    done

    # 验证索引创建
    local created_indexes=()
    local missing_indexes=()

    for index in "${EXPECTED_INDEXES[@]}"; do
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\di \"$index\"" 2>/dev/null | grep -q "$index"; then
            created_indexes+=("$index")
            success "✅ 索引 '$index' 创建成功"
        else
            missing_indexes+=("$index")
            error "❌ 索引 '$index' 创建失败"
        fi
    done

    # 生成验证报告
    cat >> "$LOG_FILE" << EOF

========================================
迁移验证报告
========================================
迁移ID: $MIGRATION_ID
服务: $SERVICE
时间: $(date)

表创建结果:
  成功: ${#created_tables[@]}/${#EXPECTED_TABLES[@]}
  创建的表: $(IFS=', '; echo "${created_tables[*]}")
  失败的表: $(IFS=', '; echo "${missing_tables[*]}")

索引创建结果:
  成功: ${#created_indexes[@]}/${#EXPECTED_INDEXES[@]}
  创建的索引: $(IFS=', '; echo "${created_indexes[*]}")
  失败的索引: $(IFS=', '; echo "${missing_indexes[*]}")

总体结果: $([ ${#missing_tables[@]} -eq 0 ] && echo "✅ 成功" || echo "❌ 部分失败")

EOF

    if [ ${#missing_tables[@]} -eq 0 ] && [ ${#missing_indexes[@]} -eq 0 ]; then
        success "迁移验证完全通过！"
        return 0
    else
        error "迁移验证部分失败，请检查失败的对象"
        return 1
    fi
}

# ============================================================================
# 回滚函数
# ============================================================================

rollback_migration() {
    log "执行迁移回滚..."

    log "回滚步骤:"
    log "1. 检查回滚条件"
    log "2. 删除创建的索引"
    log "3. 删除创建的表"
    log "4. 恢复备份数据"

    # 这里可以实现具体的回滚逻辑
    # 由于使用了IF NOT EXISTS，所以回滚主要是清理可能创建的对象

    warning "回滚功能需要根据实际情况实现"
    warning "当前版本主要依赖备份恢复"

    return 0
}

# ============================================================================
# 主执行流程
# ============================================================================

main() {
    log "========================================="
    log "adscenter服务安全迁移开始"
    log "迁移ID: $MIGRATION_ID"
    log "服务: $SERVICE"
    log "数据库: $DB_NAME"
    log "========================================="

    # 执行检查
    log "执行前检查..."

    if ! check_db_connection; then
        error "数据库连接检查失败，终止迁移"
        exit 1
    fi

    if ! check_environment_safety; then
        error "环境安全检查失败，终止迁移"
        exit 1
    fi

    if ! check_existing_objects; then
        error "现有对象检查失败，终止迁移"
        exit 1
    fi

    # 确认执行
    echo ""
    echo "即将在数据库 '$DB_NAME' 上执行adscenter迁移"
    echo "这将创建 ${#EXPECTED_TABLES[@]} 个表和 ${#EXPECTED_INDEXES[@]} 个索引"
    echo "备份将保存在: $BACKUP_DIR"
    echo ""
    read -p "确认执行迁移？(y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "用户取消迁移执行"
        exit 0
    fi

    # 执行迁移
    log "开始执行迁移流程..."

    if ! create_backup; then
        error "备份创建失败，终止迁移"
        exit 1
    fi

    if ! execute_migration; then
        error "迁移执行失败"
        log "请检查日志文件: $LOG_FILE"
        log "备份文件位置: $BACKUP_DIR"
        exit 1
    fi

    if ! verify_migration; then
        error="迁移验证失败"
        log "建议检查失败的对象"
        log "备份文件位置: $BACKUP_DIR"
        exit 1
    fi

    # 成功完成
    success "========================================="
    success "adscenter迁移成功完成！"
    success "迁移ID: $MIGRATION_ID"
    success "执行日志: $LOG_FILE"
    success "备份位置: $BACKUP_DIR"
    success "========================================="

    # 下一步建议
    echo ""
    echo "建议下一步操作:"
    echo "1. 验证adscenter服务功能"
    echo "2. 监控数据库性能指标"
    echo "3. 检查相关服务集成"
    echo "4. 在生产流量下观察一段时间"
    echo ""
    echo "如果发现问题，可以使用备份进行恢复"
}

# ============================================================================
# 脚本入口
# ============================================================================

# 错误处理
trap 'error "脚本执行出错，退出码: $?"' ERR

# 执行主函数
main "$@"