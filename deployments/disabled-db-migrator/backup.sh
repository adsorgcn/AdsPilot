#!/bin/bash
# 数据库备份脚本 - 策略B专用
# 在执行全量重建前创建完整备份

set -euo pipefail

# 配置
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
BACKUP_NAME="${BACKUP_NAME:-gm_db_$(date +%Y%m%d_%H%M%S)}"
CLOUDSQL_SOCKET="/cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm/.s.PGSQL.5432"

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

# 验证环境
validate_environment() {
    log_info "验证环境配置..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL 环境变量未设置"
        exit 1
    fi
    
    # 创建备份目录
    mkdir -p "$BACKUP_DIR"
    
    # 检查磁盘空间
    local available_space=$(df -BG "$BACKUP_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    log_info "可用磁盘空间: ${available_space}GB"
    
    if [ "$available_space" -lt 5 ]; then
        log_error "磁盘空间不足（需要至少5GB）"
        exit 1
    fi
    
    log_success "环境验证通过"
}

# 等待Cloud SQL socket
wait_for_socket() {
    log_info "等待 Cloud SQL socket: $CLOUDSQL_SOCKET"
    
    local max_wait=60
    local wait_count=0
    
    while [ ! -S "$CLOUDSQL_SOCKET" ] && [ $wait_count -lt $max_wait ]; do
        log_info "等待socket连接... ($wait_count/$max_wait)"
        sleep 1
        ((wait_count++))
    done
    
    if [ ! -S "$CLOUDSQL_SOCKET" ]; then
        log_error "Cloud SQL socket 在 ${max_wait}秒后仍未就绪"
        exit 1
    fi
    
    log_success "Cloud SQL socket 已就绪"
}

# 测试数据库连接
test_connection() {
    log_info "测试数据库连接..."
    
    if psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
        log_success "数据库连接成功"
    else
        log_error "数据库连接失败"
        exit 1
    fi
}

# 获取数据库统计信息
get_database_stats() {
    log_info "获取数据库统计信息..."
    
    # 数据库大小
    local db_size=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size('gm_db'));")
    log_info "数据库大小: $db_size"
    
    # Schema数量
    local schema_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema');")
    log_info "自定义Schema数量: $schema_count"
    
    # 表数量
    local table_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');")
    log_info "表数量: $table_count"
    
    # 保存统计信息
    cat > "$BACKUP_DIR/${BACKUP_NAME}_stats.txt" << EOF
备份统计信息
================
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
数据库大小: $db_size
Schema数量: $schema_count
表数量: $table_count
EOF
}

# 创建备份
create_backup() {
    log_info "开始创建数据库备份..."
    log_info "备份名称: $BACKUP_NAME"
    
    local backup_file="$BACKUP_DIR/${BACKUP_NAME}.dump"
    
    # 使用pg_dump创建自定义格式备份
    # -F c: 自定义格式（压缩）
    # -v: 详细输出
    # --no-owner: 不包含所有者信息
    # --no-acl: 不包含访问权限
    if pg_dump \
        -h /cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm \
        -U postgres \
        -d gm_db \
        -F c \
        -v \
        --no-owner \
        --no-acl \
        -f "$backup_file" 2>&1 | tee "$BACKUP_DIR/${BACKUP_NAME}_backup.log"; then
        log_success "备份创建成功"
    else
        log_error "备份创建失败"
        exit 1
    fi
    
    # 检查备份文件
    if [ ! -f "$backup_file" ]; then
        log_error "备份文件不存在: $backup_file"
        exit 1
    fi
    
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log_info "备份文件大小: $backup_size"
    
    # 保存备份元数据
    cat > "$BACKUP_DIR/${BACKUP_NAME}_metadata.json" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "backup_file": "$backup_file",
  "backup_size": "$backup_size",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": "gm_db",
  "instance": "${GCP_PROJECT_ID}:asia-northeast1:gm"
}
EOF
    
    log_success "备份元数据已保存"
}

# 验证备份完整性
verify_backup() {
    log_info "验证备份完整性..."
    
    local backup_file="$BACKUP_DIR/${BACKUP_NAME}.dump"
    
    # 使用pg_restore验证备份文件
    if pg_restore --list "$backup_file" > "$BACKUP_DIR/${BACKUP_NAME}_contents.txt" 2>&1; then
        log_success "备份文件验证通过"
        
        # 统计备份内容
        local schema_count=$(grep -c "SCHEMA" "$BACKUP_DIR/${BACKUP_NAME}_contents.txt" || true)
        local table_count=$(grep -c "TABLE" "$BACKUP_DIR/${BACKUP_NAME}_contents.txt" || true)
        
        log_info "备份包含: $schema_count 个Schema, $table_count 个表"
    else
        log_error "备份文件验证失败"
        exit 1
    fi
}

# 生成备份报告
generate_report() {
    log_info "生成备份报告..."
    
    cat > "$BACKUP_DIR/${BACKUP_NAME}_report.md" << EOF
# 数据库备份报告

**备份名称**: $BACKUP_NAME
**创建时间**: $(date '+%Y-%m-%d %H:%M:%S')
**数据库**: gm_db
**实例**: ${GCP_PROJECT_ID}:asia-northeast1:gm

## 备份文件

- 备份文件: \`${BACKUP_NAME}.dump\`
- 备份大小: $(du -h "$BACKUP_DIR/${BACKUP_NAME}.dump" | cut -f1)
- 统计信息: \`${BACKUP_NAME}_stats.txt\`
- 元数据: \`${BACKUP_NAME}_metadata.json\`
- 内容清单: \`${BACKUP_NAME}_contents.txt\`
- 备份日志: \`${BACKUP_NAME}_backup.log\`

## 数据库统计

$(cat "$BACKUP_DIR/${BACKUP_NAME}_stats.txt")

## 恢复命令

\`\`\`bash
pg_restore \\
  -h /cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm \\
  -U postgres \\
  -d gm_db \\
  --clean \\
  --if-exists \\
  -v \\
  $BACKUP_DIR/${BACKUP_NAME}.dump
\`\`\`

## 验证状态

✅ 备份文件已创建
✅ 备份完整性已验证
✅ 元数据已保存

---

**重要提示**: 请妥善保管此备份文件，它是恢复数据库的唯一途径。
EOF
    
    log_success "备份报告已生成"
    cat "$BACKUP_DIR/${BACKUP_NAME}_report.md"
}

# 主函数
main() {
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "数据库备份执行 - 策略B"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    validate_environment
    wait_for_socket
    test_connection
    get_database_stats
    create_backup
    verify_backup
    generate_report
    
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "备份完成！"
    log_info "备份文件: $BACKUP_DIR/${BACKUP_NAME}.dump"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 输出备份名称供后续步骤使用
    echo "BACKUP_NAME=$BACKUP_NAME" >> /tmp/backup_info.env
}

main "$@"
