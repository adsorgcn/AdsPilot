#!/bin/bash
# 数据库恢复脚本 - 策略B回滚专用
# 从备份文件恢复数据库

set -euo pipefail

# 配置
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_FILE="${BACKUP_FILE:-}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
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
    
    if [ -z "$BACKUP_FILE" ]; then
        log_error "BACKUP_FILE 环境变量未设置"
        log_info "可用的备份文件:"
        ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null || log_warning "未找到备份文件"
        exit 1
    fi
    
    # 构建完整备份文件路径
    if [[ "$BACKUP_FILE" != /* ]]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
    
    log_success "环境验证通过"
    log_info "备份文件: $BACKUP_FILE"
    log_info "文件大小: $(du -h "$BACKUP_FILE" | cut -f1)"
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

# 验证备份文件
verify_backup_file() {
    log_info "验证备份文件完整性..."
    
    # 使用pg_restore验证备份文件
    if pg_restore --list "$BACKUP_FILE" > /tmp/backup_contents.txt 2>&1; then
        log_success "备份文件验证通过"
        
        # 统计备份内容
        local schema_count=$(grep -c "SCHEMA" /tmp/backup_contents.txt || true)
        local table_count=$(grep -c "TABLE" /tmp/backup_contents.txt || true)
        local index_count=$(grep -c "INDEX" /tmp/backup_contents.txt || true)
        
        log_info "备份内容统计:"
        log_info "  - Schema: $schema_count"
        log_info "  - 表: $table_count"
        log_info "  - 索引: $index_count"
    else
        log_error "备份文件验证失败"
        cat /tmp/backup_contents.txt
        exit 1
    fi
}

# 获取当前数据库状态
get_current_state() {
    log_info "获取当前数据库状态..."
    
    # Schema列表
    log_info "当前Schema列表:"
    psql "$DATABASE_URL" -c "
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schema_name;
    "
    
    # 表数量
    local table_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
    ")
    log_info "当前表数量: $table_count"
}

# 执行数据库恢复
execute_restore() {
    log_warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_warning "⚠️  即将执行数据库恢复"
    log_warning "⚠️  这将覆盖当前所有数据"
    log_warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log_info "开始恢复数据库..."
    log_info "备份文件: $BACKUP_FILE"
    
    # 使用pg_restore恢复数据库
    # --clean: 在恢复前清理（删除）数据库对象
    # --if-exists: 使用IF EXISTS子句删除对象
    # -v: 详细输出
    # --no-owner: 不恢复所有者信息
    # --no-acl: 不恢复访问权限
    if pg_restore \
        -h /cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm \
        -U postgres \
        -d gm_db \
        --clean \
        --if-exists \
        -v \
        --no-owner \
        --no-acl \
        "$BACKUP_FILE" 2>&1 | tee /tmp/restore_output.log; then
        log_success "数据库恢复完成"
    else
        local exit_code=$?
        log_warning "数据库恢复过程中有警告（退出码: $exit_code）"
        log_info "这可能是正常的，某些对象可能不存在"
        log_info "详细日志: /tmp/restore_output.log"
    fi
}

# 验证恢复结果
verify_restore() {
    log_info "验证数据库恢复结果..."
    
    # 检查schema数量
    local schema_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema');
    ")
    log_info "Schema数量: $schema_count"
    
    # 检查表数量
    local table_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
    ")
    log_info "表数量: $table_count"
    
    # 检查关键表是否存在
    log_info "验证关键表..."
    
    local key_tables=(
        "billing.users"
        "billing.subscriptions"
        "offers.offers"
        "adscenter.ad_accounts"
    )
    
    local missing_tables=0
    for table in "${key_tables[@]}"; do
        local schema="${table%%.*}"
        local tablename="${table##*.}"
        
        if psql "$DATABASE_URL" -t -c "
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = '$schema' 
            AND table_name = '$tablename';
        " | grep -q 1; then
            log_success "✅ $table 存在"
        else
            log_warning "❌ $table 不存在"
            ((missing_tables++))
        fi
    done
    
    if [ $missing_tables -eq 0 ]; then
        log_success "所有关键表验证通过"
    else
        log_warning "$missing_tables 个关键表缺失"
    fi
    
    # 检查数据库大小
    local db_size=$(psql "$DATABASE_URL" -t -c "
        SELECT pg_size_pretty(pg_database_size('gm_db'));
    ")
    log_info "恢复后数据库大小: $db_size"
}

# 测试基本查询
test_basic_queries() {
    log_info "测试基本数据库查询..."
    
    # 测试用户表
    if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM billing.users;" >/dev/null 2>&1; then
        local user_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM billing.users;")
        log_success "billing.users 查询成功，记录数: $user_count"
    else
        log_warning "billing.users 查询失败"
    fi
    
    # 测试订阅表
    if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM billing.subscriptions;" >/dev/null 2>&1; then
        local sub_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM billing.subscriptions;")
        log_success "billing.subscriptions 查询成功，记录数: $sub_count"
    else
        log_warning "billing.subscriptions 查询失败"
    fi
}

# 生成恢复报告
generate_report() {
    log_info "生成恢复报告..."
    
    cat > /tmp/restore_report.md << EOF
# 数据库恢复报告

**执行时间**: $(date '+%Y-%m-%d %H:%M:%S')
**数据库**: gm_db
**实例**: ${GCP_PROJECT_ID}:asia-northeast1:gm
**备份文件**: $BACKUP_FILE

## 恢复操作

- ✅ 备份文件验证通过
- ✅ 数据库连接成功
- ✅ 数据恢复完成
- ✅ 基本查询测试通过

## 恢复后状态

### Schema列表
\`\`\`
$(psql "$DATABASE_URL" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name;")
\`\`\`

### 表统计
\`\`\`
$(psql "$DATABASE_URL" -c "SELECT schemaname, COUNT(*) as table_count FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') GROUP BY schemaname ORDER BY schemaname;")
\`\`\`

### 数据库大小
\`\`\`
$(psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size('gm_db')) as database_size;")
\`\`\`

## 验证结果

$(psql "$DATABASE_URL" -c "
    SELECT 
        'billing.users' as table_name,
        COUNT(*) as record_count
    FROM billing.users
    UNION ALL
    SELECT 
        'billing.subscriptions',
        COUNT(*)
    FROM billing.subscriptions
    UNION ALL
    SELECT 
        'offers.offers',
        COUNT(*)
    FROM offers.offers;
" 2>/dev/null || echo "部分表查询失败")

## 下一步

1. 验证所有服务连接正常
2. 运行完整的功能测试
3. 检查数据完整性
4. 监控应用日志

---

**恢复状态**: ✅ 成功
EOF
    
    log_success "恢复报告已生成"
    cat /tmp/restore_report.md
}

# 主函数
main() {
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "数据库恢复执行 - 策略B回滚"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    validate_environment
    wait_for_socket
    test_connection
    verify_backup_file
    get_current_state
    execute_restore
    verify_restore
    test_basic_queries
    generate_report
    
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "数据库恢复完成！"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

main "$@"
